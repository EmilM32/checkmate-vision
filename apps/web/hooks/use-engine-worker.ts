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
import type { EngineScore } from "@/context/engine-context"

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
  const { dispatch } = useEngineContext()
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

  useEffect(() => {
    annotateMoveRef.current = annotateMove
  }, [annotateMove])

  const startAnalysis = useCallback(
    (fen: string) => {
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
          depth: ANALYSIS_DEPTH,
          multipv: MULTI_PV,
        })
      )
    },
    [dispatch]
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
    latestEvalRef.current = null
    pvScoresRef.current = { 1: null, 2: null, 3: null }
    setStatus("idle")
    statusRef.current = "idle"
    dispatch({ type: "ENGINE_RESET" })
  }, [dispatch])

  // React to FEN changes with debounce
  useEffect(() => {
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
    if (workerRef.current) {
      workerRef.current.onmessage = handleMessage
    }
  }, [handleMessage])

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
