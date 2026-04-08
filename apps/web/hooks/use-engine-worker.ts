"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Chess } from "chess.js"
import { useEngineContext } from "@/context"
import { useGameContext } from "@/context"
import {
  classifyMove,
  computeMoveDelta,
  type ClassificationInput,
} from "@/lib/chess/classification"
import { parseInfoLine, parseBestMoveLine } from "@/lib/engine/parser"
import { serializeCommand } from "@/lib/engine/worker"
import type { BatchAnalysisItem, EngineScore } from "@/context/engine-context"

export type EngineWorkerStatus = "idle" | "initializing" | "ready" | "analyzing"

const DEBOUNCE_MS = 150
const ANALYSIS_DEPTH = 20
const MULTI_PV = 3

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
} as const

type PendingMoveClassification = {
  moveIndex: number
  playedBy: "white" | "black"
  scoreBefore: EngineScore
  isOnlyLegalMove: boolean
  isMaterialSacrifice: boolean
}

type BatchRuntime = {
  requestId: number
  queue: BatchAnalysisItem[]
  currentIndex: number
  completed: number
  previousScore: EngineScore
  running: boolean
  cancelled: boolean
}

function countLegalMoves(fen: string): number {
  try {
    return new Chess(fen).moves().length
  } catch {
    return 0
  }
}

function getSideMaterial(fen: string, side: "w" | "b"): number {
  try {
    const chess = new Chess(fen)
    return chess
      .board()
      .flatMap((row) => row)
      .reduce((acc, piece) => {
        if (!piece || piece.color !== side) return acc
        return acc + PIECE_VALUES[piece.type]
      }, 0)
  } catch {
    return 0
  }
}

function isMaterialSacrifice(
  fenBefore: string,
  fenAfter: string,
  playedBy: "white" | "black"
): boolean {
  const side = playedBy === "white" ? "w" : "b"
  return getSideMaterial(fenAfter, side) < getSideMaterial(fenBefore, side)
}

function perspectiveValue(
  score: EngineScore,
  playedBy: "white" | "black"
): number {
  if (!score) return 0
  const direction = playedBy === "white" ? 1 : -1
  return score.value * direction
}

function isLosingScore(
  score: EngineScore,
  playedBy: "white" | "black"
): boolean {
  if (!score) return false
  if (score.type === "mate") return perspectiveValue(score, playedBy) < 0
  return perspectiveValue(score, playedBy) <= -250
}

function isWinningScore(
  score: EngineScore,
  playedBy: "white" | "black"
): boolean {
  if (!score) return false
  if (score.type === "mate") return perspectiveValue(score, playedBy) > 0
  return perspectiveValue(score, playedBy) >= 250
}

function getPvGapCp(first: EngineScore, second: EngineScore): number | null {
  if (!first || !second) return null
  if (first.type !== "cp" || second.type !== "cp") return null
  return Math.abs(first.value - second.value)
}

export function useEngineWorker() {
  const { state: engineState, dispatch } = useEngineContext()
  const { state: gameState, annotateMove } = useGameContext()

  const [status, setStatus] = useState<EngineWorkerStatus>("idle")

  const workerRef = useRef<Worker | null>(null)
  const isAnalyzingRef = useRef(false)
  const waitingForStopRef = useRef(false)
  const pendingFenRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusRef = useRef<EngineWorkerStatus>("idle")
  const annotateMoveRef = useRef(annotateMove)
  const latestEvalRef = useRef<EngineScore>(null)
  const pvScoresRef = useRef<{
    1: EngineScore
    2: EngineScore
    3: EngineScore
  }>({ 1: null, 2: null, 3: null })
  const pendingMoveRef = useRef<PendingMoveClassification | null>(null)
  const previousGameRef = useRef(gameState)
  const batchRunRef = useRef<BatchRuntime>({
    requestId: 0,
    queue: [],
    currentIndex: 0,
    completed: 0,
    previousScore: null,
    running: false,
    cancelled: false,
  })
  const queuedBatchRef = useRef<{
    requestId: number
    queue: BatchAnalysisItem[]
  } | null>(null)
  const seenBatchRequestIdRef = useRef(0)

  useEffect(() => {
    annotateMoveRef.current = annotateMove
  }, [annotateMove])

  const startAnalysis = useCallback(
    (fen: string, depth = ANALYSIS_DEPTH) => {
      const worker = workerRef.current
      if (!worker) return

      dispatch({ type: "ENGINE_START_ANALYSIS" })
      pvScoresRef.current = { 1: null, 2: null, 3: null }
      setStatus("analyzing")
      statusRef.current = "analyzing"
      isAnalyzingRef.current = true

      worker.postMessage(serializeCommand({ type: "position", fen }))
      worker.postMessage(
        serializeCommand({
          type: "go",
          depth,
          multipv: MULTI_PV,
        })
      )
    },
    [dispatch]
  )

  const startBatchAtIndex = useCallback(
    (index: number) => {
      const batch = batchRunRef.current
      const item = batch.queue[index]
      if (!item) {
        batch.running = false
        dispatch({ type: "ENGINE_BATCH_DONE" })
        return
      }

      batch.currentIndex = index
      startAnalysis(item.fen, ANALYSIS_DEPTH)
    },
    [dispatch, startAnalysis]
  )

  const beginBatch = useCallback(
    (requestId: number, queue: BatchAnalysisItem[]) => {
      if (queue.length === 0) {
        dispatch({ type: "ENGINE_BATCH_DONE" })
        return
      }

      pendingFenRef.current = null
      waitingForStopRef.current = false
      pendingMoveRef.current = null

      batchRunRef.current = {
        requestId,
        queue,
        currentIndex: 0,
        completed: 0,
        previousScore: null,
        running: true,
        cancelled: false,
      }

      startBatchAtIndex(0)
    },
    [dispatch, startBatchAtIndex]
  )

  const requestAnalysis = useCallback(
    (fen: string) => {
      const worker = workerRef.current
      if (!worker) return

      if (isAnalyzingRef.current || waitingForStopRef.current) {
        pendingFenRef.current = fen
        if (!waitingForStopRef.current) {
          waitingForStopRef.current = true
          worker.postMessage(serializeCommand({ type: "stop" }))
        }
      } else {
        startAnalysis(fen)
      }
    },
    [startAnalysis]
  )

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : String(e.data)

      if (line === "uciok") {
        workerRef.current?.postMessage(serializeCommand({ type: "isready" }))
        return
      }

      if (line === "readyok") {
        setStatus("ready")
        statusRef.current = "ready"
        return
      }

      const info = parseInfoLine(line)
      if (info) {
        pvScoresRef.current[info.multipv] = info.score
        if (info.multipv === 1 && info.score) {
          latestEvalRef.current = info.score
        }
        dispatch({ type: "ENGINE_OUTPUT", info })
        return
      }

      const bestMove = parseBestMoveLine(line)
      if (bestMove) {
        isAnalyzingRef.current = false
        dispatch({ type: "ENGINE_BESTMOVE", bestMove })

        if (queuedBatchRef.current) {
          const queuedBatch = queuedBatchRef.current
          queuedBatchRef.current = null
          beginBatch(queuedBatch.requestId, queuedBatch.queue)
          return
        }

        if (batchRunRef.current.running) {
          const batch = batchRunRef.current
          const item = batch.queue[batch.currentIndex]
          const scoreAfter = pvScoresRef.current[1]
          const pvGapCp = getPvGapCp(
            pvScoresRef.current[1],
            pvScoresRef.current[2]
          )

          if (item) {
            if (item.moveIndex === 0) {
              batch.previousScore = scoreAfter
            } else {
              const playedBy: "white" | "black" =
                item.moveIndex % 2 === 1 ? "white" : "black"
              const scoreBefore = batch.previousScore
              const isOnlyWinningMoveInLosingPosition =
                isLosingScore(scoreBefore, playedBy) &&
                isWinningScore(scoreAfter, playedBy)

              const delta = computeMoveDelta(scoreBefore, scoreAfter, playedBy)
              const input: ClassificationInput = {
                scoreBefore,
                scoreAfter,
                playedBy,
                plyIndex: item.moveIndex,
                pvGapCp,
                isOnlyLegalMove: countLegalMoves(item.fenBefore) === 1,
                isMaterialSacrifice: isMaterialSacrifice(
                  item.fenBefore,
                  item.fen,
                  playedBy
                ),
                isOnlyWinningMoveInLosingPosition,
              }

              const classification =
                scoreBefore && scoreAfter ? classifyMove(input) : null

              annotateMoveRef.current(item.moveIndex, {
                scoreBefore,
                scoreAfter,
                delta,
                classification,
              })

              batch.previousScore = scoreAfter
            }

            batch.completed += 1
            dispatch({
              type: "ENGINE_BATCH_PROGRESS",
              completed: batch.completed,
              currentMoveIndex: item.moveIndex,
            })
          }

          if (batch.cancelled) {
            batch.running = false
            dispatch({ type: "ENGINE_BATCH_CANCELLED" })
            setStatus("ready")
            statusRef.current = "ready"
            return
          }

          const nextIndex = batch.currentIndex + 1
          if (nextIndex < batch.queue.length) {
            startBatchAtIndex(nextIndex)
          } else {
            batch.running = false
            dispatch({ type: "ENGINE_BATCH_DONE" })
            setStatus("ready")
            statusRef.current = "ready"
          }
          return
        }

        const pendingMove = pendingMoveRef.current
        const scoreAfter = pvScoresRef.current[1]

        if (pendingMove) {
          const pvGapCp = getPvGapCp(
            pvScoresRef.current[1],
            pvScoresRef.current[2]
          )
          const isOnlyWinningMoveInLosingPosition =
            isLosingScore(pendingMove.scoreBefore, pendingMove.playedBy) &&
            isWinningScore(scoreAfter, pendingMove.playedBy)

          const delta = computeMoveDelta(
            pendingMove.scoreBefore,
            scoreAfter,
            pendingMove.playedBy
          )

          const input: ClassificationInput = {
            scoreBefore: pendingMove.scoreBefore,
            scoreAfter,
            playedBy: pendingMove.playedBy,
            plyIndex: pendingMove.moveIndex,
            pvGapCp,
            isOnlyLegalMove: pendingMove.isOnlyLegalMove,
            isMaterialSacrifice: pendingMove.isMaterialSacrifice,
            isOnlyWinningMoveInLosingPosition,
          }

          const classification =
            pendingMove.scoreBefore && scoreAfter ? classifyMove(input) : null

          annotateMoveRef.current(pendingMove.moveIndex, {
            scoreBefore: pendingMove.scoreBefore,
            scoreAfter,
            delta,
            classification,
          })

          pendingMoveRef.current = null
        }

        if (scoreAfter) {
          latestEvalRef.current = scoreAfter
        }

        if (waitingForStopRef.current) {
          waitingForStopRef.current = false
          const pendingFen = pendingFenRef.current
          pendingFenRef.current = null
          if (pendingFen) {
            startAnalysis(pendingFen)
          }
        }
        return
      }
    },
    [dispatch, startAnalysis]
  )

  const init = useCallback(() => {
    if (workerRef.current) return

    setStatus("initializing")
    statusRef.current = "initializing"

    const worker = new Worker("/stockfish/stockfish.wasm.js")
    workerRef.current = worker
    worker.onmessage = handleMessage
    worker.onerror = (err) => {
      console.error("Stockfish worker error:", err)
    }

    worker.postMessage(serializeCommand({ type: "uci" }))
  }, [handleMessage])

  const terminate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    workerRef.current?.terminate()
    workerRef.current = null
    isAnalyzingRef.current = false
    waitingForStopRef.current = false
    pendingFenRef.current = null
    pendingMoveRef.current = null
    queuedBatchRef.current = null
    batchRunRef.current = {
      requestId: 0,
      queue: [],
      currentIndex: 0,
      completed: 0,
      previousScore: null,
      running: false,
      cancelled: false,
    }
    latestEvalRef.current = null
    pvScoresRef.current = { 1: null, 2: null, 3: null }
    setStatus("idle")
    statusRef.current = "idle"
    dispatch({ type: "ENGINE_RESET" })
  }, [dispatch])

  // React to FEN changes with debounce
  useEffect(() => {
    if (batchRunRef.current.running || queuedBatchRef.current) return

    if (statusRef.current !== "ready" && statusRef.current !== "analyzing")
      return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      requestAnalysis(gameState.fen)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [gameState.fen, requestAnalysis])

  useEffect(() => {
    if (batchRunRef.current.running || queuedBatchRef.current) {
      previousGameRef.current = gameState
      return
    }

    const previous = previousGameRef.current
    const isOneNewMove =
      gameState.currentMoveIndex === previous.currentMoveIndex + 1 &&
      gameState.history.length === previous.history.length + 1

    if (isOneNewMove) {
      const moveIndex = gameState.currentMoveIndex
      const playedBy = previous.turn === "w" ? "white" : "black"
      const moveEntry = gameState.history[moveIndex - 1]
      if (moveEntry) {
        pendingMoveRef.current = {
          moveIndex,
          playedBy,
          scoreBefore: latestEvalRef.current,
          isOnlyLegalMove: countLegalMoves(previous.fen) === 1,
          isMaterialSacrifice: isMaterialSacrifice(
            previous.fen,
            moveEntry.fen,
            playedBy
          ),
        }
      }
    }

    previousGameRef.current = gameState
  }, [gameState])

  useEffect(() => {
    dispatch({ type: "ENGINE_CONCEAL_ANALYSIS" })
  }, [gameState.fen, dispatch])

  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.onmessage = handleMessage
    }
  }, [handleMessage])

  useEffect(() => {
    const { requestId, queue } = engineState.batch
    if (requestId === 0 || requestId === seenBatchRequestIdRef.current) return

    seenBatchRequestIdRef.current = requestId

    if (!workerRef.current) {
      dispatch({
        type: "ENGINE_BATCH_ERROR",
        error: "Silnik nie jest gotowy.",
      })
      return
    }

    if (isAnalyzingRef.current) {
      queuedBatchRef.current = { requestId, queue }
      pendingFenRef.current = null
      waitingForStopRef.current = true
      workerRef.current.postMessage(serializeCommand({ type: "stop" }))
      return
    }

    beginBatch(requestId, queue)
  }, [engineState.batch, dispatch, beginBatch])

  useEffect(() => {
    if (!engineState.batch.cancelRequested) return

    const batch = batchRunRef.current
    if (!batch.running) {
      dispatch({ type: "ENGINE_BATCH_CANCELLED" })
      return
    }

    batch.cancelled = true
    pendingFenRef.current = null
    queuedBatchRef.current = null

    if (!isAnalyzingRef.current) {
      batch.running = false
      dispatch({ type: "ENGINE_BATCH_CANCELLED" })
      return
    }

    workerRef.current?.postMessage(serializeCommand({ type: "stop" }))
  }, [engineState.batch.cancelRequested, dispatch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  return {
    status,
    start: init,
    stop: terminate,
  }
}
