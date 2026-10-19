"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEngineContext } from "@/context"
import { useGameContext } from "@/context"
import {
  buildMoveAnalysis,
  getPvGapCp,
  getTerminalScore,
} from "@/lib/chess/move-analysis"
import { getSideToMove, toWhitePerspective } from "@/lib/engine/eval"
import { parseInfoLine, parseBestMoveLine } from "@/lib/engine/parser"
import { ENGINE_URL } from "@/lib/engine/engine-url"
import { serializeCommand } from "@/lib/engine/worker"
import type { EngineScore } from "@/context/engine-context"

export type EngineWorkerStatus = "idle" | "initializing" | "ready" | "analyzing"

const DEBOUNCE_MS = 150
// Live analysis streams results, so it can search deep and show three lines;
// the time cap stops it from running for minutes in endgames, where depth
// grows slowly. Game analysis runs in its own workers (useGameAnalysis).
const LIVE_SEARCH = { depth: 22, movetimeMs: 12_000, multiPv: 3 }
const HASH_MB = 32
// The lite engine is ~1.9 MB; on a slow connection it can take a while, but
// a worker that never answers "uci" should not leave the UI spinning.
export const ENGINE_START_TIMEOUT_MS = 20_000

type PendingMoveClassification = {
  moveIndex: number
  fenBefore: string
  fenAfter: string
  scoreBefore: EngineScore
}

/** The live engine: analyses the position on the board as it changes. */
export function useEngineWorker() {
  const { dispatch } = useEngineContext()
  const { state: gameState, annotateMove } = useGameContext()

  const [status, setStatus] = useState<EngineWorkerStatus>("idle")

  const workerRef = useRef<Worker | null>(null)
  const isAnalyzingRef = useRef(false)
  const waitingForStopRef = useRef(false)
  const pendingFenRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusRef = useRef<EngineWorkerStatus>("idle")
  const annotateMoveRef = useRef(annotateMove)
  const fenRef = useRef(gameState.fen)
  const searchFenRef = useRef<string | null>(null)
  const handleMessageRef = useRef<((e: MessageEvent) => void) | null>(null)
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

  useEffect(() => {
    fenRef.current = gameState.fen
  }, [gameState.fen])

  const startAnalysis = useCallback(
    (fen: string) => {
      const worker = workerRef.current
      if (!worker) return

      dispatch({ type: "ENGINE_START_ANALYSIS" })
      pvScoresRef.current = { 1: null, 2: null, 3: null }
      searchFenRef.current = fen
      setStatus("analyzing")
      statusRef.current = "analyzing"
      isAnalyzingRef.current = true

      const terminalScore = getTerminalScore(fen)
      if (terminalScore) {
        pvScoresRef.current[1] = terminalScore
        dispatch({ type: "ENGINE_TERMINAL_POSITION", score: terminalScore })
        // Finish asynchronously, like a real search, so the regular
        // bestmove flow (classification, pending FEN) runs.
        setTimeout(() => {
          if (workerRef.current !== worker) return
          handleMessageRef.current?.(
            new MessageEvent("message", { data: "bestmove (none)" })
          )
        }, 0)
        return
      }

      worker.postMessage(serializeCommand({ type: "position", fen }))
      worker.postMessage(
        serializeCommand({
          type: "go",
          depth: LIVE_SEARCH.depth,
          movetimeMs: LIVE_SEARCH.movetimeMs,
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
        const worker = workerRef.current
        worker?.postMessage(
          serializeCommand({ type: "setoption", name: "Hash", value: HASH_MB })
        )
        // MultiPV is an engine option; "go ... multipv" is not valid UCI.
        worker?.postMessage(
          serializeCommand({
            type: "setoption",
            name: "MultiPV",
            value: LIVE_SEARCH.multiPv,
          })
        )
        worker?.postMessage(serializeCommand({ type: "isready" }))
        return
      }

      if (line === "readyok") {
        if (startTimeoutRef.current) {
          clearTimeout(startTimeoutRef.current)
          startTimeoutRef.current = null
        }
        dispatch({ type: "ENGINE_READY" })
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

        // Only the search of the position reached by the move describes it;
        // a search stopped because of that move belongs to the previous one.
        if (pendingMove && pendingMove.fenAfter === searchFenRef.current) {
          annotateMoveRef.current(
            pendingMove.moveIndex,
            buildMoveAnalysis({
              ply: pendingMove.moveIndex,
              fenBefore: pendingMove.fenBefore,
              fenAfter: pendingMove.fenAfter,
              scoreBefore: pendingMove.scoreBefore,
              scoreAfter,
              pvGapCp: getPvGapCp(
                pvScoresRef.current[1],
                pvScoresRef.current[2]
              ),
            }),
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
      }
    },
    [dispatch, startAnalysis]
  )

  const terminate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current)
      startTimeoutRef.current = null
    }
    workerRef.current?.terminate()
    workerRef.current = null
    searchFenRef.current = null
    isAnalyzingRef.current = false
    waitingForStopRef.current = false
    pendingFenRef.current = null
    pendingMoveRef.current = null
    latestEvalRef.current = null
    pvScoresRef.current = { 1: null, 2: null, 3: null }
    setStatus("idle")
    statusRef.current = "idle"
    dispatch({ type: "ENGINE_LIVE_RESET" })
  }, [dispatch])

  const fail = useCallback(
    (error: string, cause?: unknown) => {
      console.error("Stockfish engine failure:", error, cause)
      terminate()
      dispatch({ type: "ENGINE_ERROR", error })
    },
    [dispatch, terminate]
  )

  const init = useCallback(() => {
    if (workerRef.current) return

    setStatus("initializing")
    statusRef.current = "initializing"

    let worker: Worker
    try {
      worker = new Worker(ENGINE_URL)
    } catch (cause) {
      fail("errors.engineLoadFailed", cause)
      return
    }

    workerRef.current = worker
    worker.onmessage = handleMessage
    worker.onerror = (event) => {
      event.preventDefault()
      fail(
        statusRef.current === "initializing"
          ? "errors.engineLoadFailed"
          : "errors.engineCrashed",
        event.message
      )
    }
    startTimeoutRef.current = setTimeout(() => {
      fail("errors.engineLoadFailed", "start timeout")
    }, ENGINE_START_TIMEOUT_MS)

    worker.postMessage(serializeCommand({ type: "uci" }))
  }, [fail, handleMessage])

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

  // A move played on the board is classified once its position is analysed.
  useEffect(() => {
    const previous = previousGameRef.current
    const isOneNewMove =
      gameState.currentMoveIndex === previous.currentMoveIndex + 1 &&
      gameState.history.length === previous.history.length + 1

    if (isOneNewMove) {
      const moveIndex = gameState.currentMoveIndex
      const moveEntry = gameState.history[moveIndex - 1]
      if (moveEntry) {
        pendingMoveRef.current = {
          moveIndex,
          fenBefore: previous.fen,
          fenAfter: moveEntry.fen,
          scoreBefore: latestEvalRef.current,
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
