"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useEngineContext } from "@/context"
import { useGameContext } from "@/context"
import { parseInfoLine, parseBestMoveLine } from "@/lib/engine/parser"
import { serializeCommand } from "@/lib/engine/worker"

export type EngineWorkerStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "analyzing"

const DEBOUNCE_MS = 150
const ANALYSIS_DEPTH = 20
const MULTI_PV = 3

export function useEngineWorker() {
  const { dispatch } = useEngineContext()
  const { state: gameState } = useGameContext()

  const [status, setStatus] = useState<EngineWorkerStatus>("idle")

  const workerRef = useRef<Worker | null>(null)
  const isAnalyzingRef = useRef(false)
  const waitingForStopRef = useRef(false)
  const pendingFenRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statusRef = useRef<EngineWorkerStatus>("idle")

  const startAnalysis = useCallback(
    (fen: string) => {
      const worker = workerRef.current
      if (!worker) return

      dispatch({ type: "ENGINE_START_ANALYSIS" })
      setStatus("analyzing")
      statusRef.current = "analyzing"
      isAnalyzingRef.current = true

      worker.postMessage(serializeCommand({ type: "position", fen }))
      worker.postMessage(
        serializeCommand({
          type: "go",
          depth: ANALYSIS_DEPTH,
          multipv: MULTI_PV,
        }),
      )
    },
    [dispatch],
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
    [startAnalysis],
  )

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : String(e.data)

      if (line === "uciok") {
        workerRef.current?.postMessage(
          serializeCommand({ type: "isready" }),
        )
        return
      }

      if (line === "readyok") {
        setStatus("ready")
        statusRef.current = "ready"
        return
      }

      const info = parseInfoLine(line)
      if (info) {
        dispatch({ type: "ENGINE_OUTPUT", info })
        return
      }

      const bestMove = parseBestMoveLine(line)
      if (bestMove) {
        isAnalyzingRef.current = false
        dispatch({ type: "ENGINE_BESTMOVE", bestMove })

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
    [dispatch, startAnalysis],
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
