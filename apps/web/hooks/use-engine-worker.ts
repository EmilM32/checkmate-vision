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
import { getSideToMove, toWhitePerspective } from "@/lib/engine/eval"
import { parseInfoLine, parseBestMoveLine } from "@/lib/engine/parser"
import { serializeCommand } from "@/lib/engine/worker"
import type { BatchAnalysisItem, EngineScore } from "@/context/engine-context"

export type EngineWorkerStatus = "idle" | "initializing" | "ready" | "analyzing"

// "live" searches drive the on-screen analysis of the current position;
// "batch" searches only feed game analysis and never touch the live view.
type SearchMode = "live" | "batch"

const DEBOUNCE_MS = 150
// Live analysis streams results, so it can search deeper and show three
// lines. Game analysis waits for every position: it only needs the gap
// between the two best lines and a shallower search keeps it to a few
// seconds per position in the single-threaded WASM build.
const SEARCH_SETTINGS: Record<SearchMode, { depth: number; multiPv: number }> =
  {
    live: { depth: 20, multiPv: 3 },
    batch: { depth: 16, multiPv: 2 },
  }

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
  fenAfter: string
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

// Positions without legal moves are never sent to Stockfish: it answers them
// with a depth-0 info line and "bestmove (none)", which carry no useful lines.
function getTerminalScore(fen: string): EngineScore {
  try {
    const chess = new Chess(fen)
    if (chess.moves().length > 0) return null
    return chess.isCheck()
      ? { type: "mate", value: 0 }
      : { type: "cp", value: 0 }
  } catch {
    return null
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
  const fenRef = useRef(gameState.fen)
  const searchFenRef = useRef<string | null>(null)
  const searchModeRef = useRef<SearchMode>("live")
  const engineMultiPvRef = useRef<number | null>(null)
  const liveFenRef = useRef<string | null>(null)
  const handleMessageRef = useRef<((e: MessageEvent) => void) | null>(null)
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

  useEffect(() => {
    fenRef.current = gameState.fen
  }, [gameState.fen])

  const startAnalysis = useCallback(
    (fen: string, mode: SearchMode = "live") => {
      const worker = workerRef.current
      if (!worker) return

      const isLive = mode === "live"
      if (isLive) {
        dispatch({ type: "ENGINE_START_ANALYSIS" })
        liveFenRef.current = fen
      }
      pvScoresRef.current = { 1: null, 2: null, 3: null }
      searchFenRef.current = fen
      searchModeRef.current = mode
      setStatus("analyzing")
      statusRef.current = "analyzing"
      isAnalyzingRef.current = true

      const terminalScore = getTerminalScore(fen)
      if (terminalScore) {
        pvScoresRef.current[1] = terminalScore
        if (isLive) {
          dispatch({ type: "ENGINE_TERMINAL_POSITION", score: terminalScore })
        }
        // Finish asynchronously, like a real search, so the regular
        // bestmove flow (classification, batch, pending FEN) runs.
        setTimeout(() => {
          if (workerRef.current !== worker) return
          handleMessageRef.current?.(
            new MessageEvent("message", { data: "bestmove (none)" })
          )
        }, 0)
        return
      }

      const settings = SEARCH_SETTINGS[mode]
      // Options may only change while the engine is idle, which is always
      // the case here: a search starts only after the previous bestmove.
      if (engineMultiPvRef.current !== settings.multiPv) {
        engineMultiPvRef.current = settings.multiPv
        worker.postMessage(
          serializeCommand({
            type: "setoption",
            name: "MultiPV",
            value: settings.multiPv,
          })
        )
      }
      worker.postMessage(serializeCommand({ type: "position", fen }))
      worker.postMessage(
        serializeCommand({ type: "go", depth: settings.depth })
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
      startAnalysis(item.fen, "batch")
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

  // After game analysis the engine returns to the position on the board,
  // which may have changed while the batch was running.
  const resumeLiveAnalysis = useCallback(() => {
    startAnalysis(fenRef.current)
  }, [startAnalysis])

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
        const worker = workerRef.current
        // Stockfish 10 defaults to Contempt 24, which biases every score
        // towards the side to move and made evaluations swing by ~0.7 pawns
        // from ply to ply. Analysis needs an unbiased evaluation.
        worker?.postMessage(
          serializeCommand({ type: "setoption", name: "Contempt", value: 0 })
        )
        // MultiPV is an engine option; "go ... multipv" is not valid UCI and
        // was silently ignored, leaving a single line.
        engineMultiPvRef.current = SEARCH_SETTINGS.live.multiPv
        worker?.postMessage(
          serializeCommand({
            type: "setoption",
            name: "MultiPV",
            value: SEARCH_SETTINGS.live.multiPv,
          })
        )
        worker?.postMessage(serializeCommand({ type: "isready" }))
        return
      }

      if (line === "readyok") {
        setStatus("ready")
        statusRef.current = "ready"
        startAnalysis(fenRef.current)
        return
      }

      const parsedInfo = parseInfoLine(line)
      if (parsedInfo) {
        const info = {
          ...parsedInfo,
          score: toWhitePerspective(
            parsedInfo.score,
            getSideToMove(searchFenRef.current ?? fenRef.current)
          ),
        }
        pvScoresRef.current[info.multipv] = info.score
        if (searchModeRef.current === "batch") return

        if (info.multipv === 1 && info.score) {
          latestEvalRef.current = info.score
        }
        dispatch({ type: "ENGINE_OUTPUT", info })
        return
      }

      const bestMove = parseBestMoveLine(line)
      if (bestMove) {
        isAnalyzingRef.current = false
        if (searchModeRef.current === "live") {
          dispatch({ type: "ENGINE_BESTMOVE", bestMove })
        }

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

              annotateMoveRef.current(
                item.moveIndex,
                { scoreBefore, scoreAfter, delta, classification },
                item.fen
              )

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
            resumeLiveAnalysis()
            return
          }

          const nextIndex = batch.currentIndex + 1
          if (nextIndex < batch.queue.length) {
            startBatchAtIndex(nextIndex)
          } else {
            batch.running = false
            dispatch({ type: "ENGINE_BATCH_DONE" })
            resumeLiveAnalysis()
          }
          return
        }

        const pendingMove = pendingMoveRef.current
        const scoreAfter = pvScoresRef.current[1]

        // Only the search of the position reached by the move describes it;
        // a search stopped because of that move belongs to the previous one.
        if (pendingMove && pendingMove.fenAfter === searchFenRef.current) {
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

          annotateMoveRef.current(
            pendingMove.moveIndex,
            {
              scoreBefore: pendingMove.scoreBefore,
              scoreAfter,
              delta,
              classification,
            },
            pendingMove.fenAfter
          )

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
    [dispatch, startAnalysis, beginBatch, startBatchAtIndex, resumeLiveAnalysis]
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
    searchFenRef.current = null
    searchModeRef.current = "live"
    engineMultiPvRef.current = null
    liveFenRef.current = null
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
    if (batchRunRef.current.running || queuedBatchRef.current) {
      // The engine is busy with the game; drop live lines that describe a
      // different position until the batch ends and live analysis resumes.
      if (liveFenRef.current && liveFenRef.current !== gameState.fen) {
        liveFenRef.current = null
        dispatch({ type: "ENGINE_CLEAR_ANALYSIS" })
      }
      return
    }

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
  }, [gameState.fen, requestAnalysis, dispatch])

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
          fenAfter: moveEntry.fen,
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
    handleMessageRef.current = handleMessage
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
      resumeLiveAnalysis()
      return
    }

    workerRef.current?.postMessage(serializeCommand({ type: "stop" }))
  }, [engineState.batch.cancelRequested, dispatch, resumeLiveAnalysis])

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
