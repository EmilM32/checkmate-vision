"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useEngineContext } from "@/context"
import { useGameContext } from "@/context"
import { buildMoveAnalysis, getTerminalScore } from "@/lib/chess/move-analysis"
import { analysisCache } from "@/lib/engine/analysis-cache"
import { ENGINE_URL } from "@/lib/engine/engine-url"
import type { EngineLine, EngineScore } from "@/context/engine-context"
import type { ParsedBestMove } from "@/lib/engine/types"
import {
  EngineFailure,
  UciEngine,
  type EngineWorker,
  type SearchResult,
} from "@/lib/engine/uci-engine"

export type EngineWorkerStatus = "idle" | "initializing" | "ready" | "analyzing"

const DEBOUNCE_MS = 150
// Live analysis streams results, so it can search deep and show three lines;
// the time cap stops it from running for minutes in endgames, where depth
// grows slowly. Game analysis runs in its own workers (useGameAnalysis).
const LIVE_MULTIPV = 3
const LIVE_SEARCH = { depth: 22, movetimeMs: 12_000 }
const HASH_MB = 32
// The lite engine is ~1.9 MB; on a slow connection it can take a while, but
// a worker that never answers "uci" should not leave the UI spinning.
export const ENGINE_START_TIMEOUT_MS = 20_000

type LineScoreMap = { 1: EngineScore; 2: EngineScore; 3: EngineScore }

type PendingMoveClassification = {
  // A move of the game, or one played in a variation.
  target: "main" | "variation"
  moveIndex: number
  fenBefore: string
  fenAfter: string
  scoreBefore: EngineScore
}

function emptyScores(): LineScoreMap {
  return { 1: null, 2: null, 3: null }
}

function errorKey(error: unknown) {
  return error instanceof EngineFailure && error.reason === "load"
    ? "errors.engineLoadFailed"
    : "errors.engineCrashed"
}

// The search of the position before the move left its lines in the cache
// (stopped early if the move interrupted it); the last best score is the
// fallback.
function getLinesBefore(pending: PendingMoveClassification): EngineLine[] {
  const cached = analysisCache.get(pending.fenBefore, LIVE_MULTIPV)
  if (cached) return cached.lines
  return pending.scoreBefore
    ? [{ id: 1, score: pending.scoreBefore, pv: [] }]
    : []
}

/** The live engine: analyses the position on the board as it changes. */
export function useEngineWorker() {
  const { dispatch } = useEngineContext()
  const {
    state: gameState,
    annotateMove,
    annotateVariationMove,
  } = useGameContext()

  const [status, setStatus] = useState<EngineWorkerStatus>("idle")

  const engineRef = useRef<UciEngine | null>(null)
  const statusRef = useRef<EngineWorkerStatus>("idle")
  const fenRef = useRef(gameState.fen)
  const annotateMoveRef = useRef(annotateMove)
  const annotateVariationMoveRef = useRef(annotateVariationMove)
  const searchFenRef = useRef<string | null>(null)
  const latestEvalRef = useRef<EngineScore>(null)
  const pvScoresRef = useRef<LineScoreMap>(emptyScores())
  const pendingMoveRef = useRef<PendingMoveClassification | null>(null)
  const previousGameRef = useRef(gameState)
  const linesRef = useRef(new Map<1 | 2 | 3, EngineLine>())
  const depthRef = useRef(0)
  const stopRequestedRef = useRef(false)
  const cachedDepthRef = useRef(0)
  const pausedRef = useRef(false)
  const pendingFenRef = useRef<string | null>(null)
  const failedRef = useRef(false)
  const errorRef = useRef<string | null>(null)
  const lifeRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runSearchRef = useRef<(fen: string) => Promise<void>>(async () => {})
  const requestRef = useRef<(fen: string) => void>(() => {})
  const failRef = useRef<(error: unknown) => void>(() => {})
  const stopRef = useRef<() => void>(() => {})

  const setEngineStatus = (next: EngineWorkerStatus) => {
    statusRef.current = next
    setStatus(next)
  }

  useEffect(() => {
    annotateMoveRef.current = annotateMove
    annotateVariationMoveRef.current = annotateVariationMove
  }, [annotateMove, annotateVariationMove])

  useLayoutEffect(() => {
    const previous = fenRef.current
    fenRef.current = gameState.fen
    if (previous === gameState.fen) return
    dispatch({ type: "ENGINE_NEW_POSITION" })
  }, [gameState.fen, dispatch])

  const failEngine = (error: unknown) => {
    console.error("Stockfish engine failure:", error)
    pendingFenRef.current = null
    stopRequestedRef.current = false
    pausedRef.current = false
    searchFenRef.current = null
    failedRef.current = true
    errorRef.current = errorKey(error)
    setEngineStatus("idle")
    dispatch({ type: "ENGINE_ERROR", error: errorRef.current })
  }

  const completeSearch = (fen: string, complete: boolean) => {
    if (searchFenRef.current === fen) {
      analysisCache.set(fen, LIVE_MULTIPV, {
        depth: depthRef.current,
        lines: [...linesRef.current.values()].sort((a, b) => a.id - b.id),
        complete,
      })
    }

    const pendingMove = pendingMoveRef.current
    const scoreAfter = pvScoresRef.current[1]
    if (pendingMove && pendingMove.fenAfter === fen) {
      const analysis = buildMoveAnalysis({
        fenBefore: pendingMove.fenBefore,
        fenAfter: pendingMove.fenAfter,
        linesBefore: getLinesBefore(pendingMove),
        scoreAfter,
      })
      if (pendingMove.target === "variation") {
        annotateVariationMoveRef.current(
          pendingMove.moveIndex,
          analysis,
          pendingMove.fenAfter
        )
      } else {
        annotateMoveRef.current(
          pendingMove.moveIndex,
          analysis,
          pendingMove.fenAfter
        )
      }
      pendingMoveRef.current = null
    }

    if (scoreAfter) latestEvalRef.current = scoreAfter
    const bestMove: ParsedBestMove = {
      move: linesRef.current.get(1)?.pv[0] ?? null,
      ponder: null,
    }
    dispatch({ type: "ENGINE_BESTMOVE", bestMove })

    const next = pendingFenRef.current
    pendingFenRef.current = null
    stopRequestedRef.current = false
    if (next && !pausedRef.current) {
      void runSearchRef.current(next)
      return
    }
    setEngineStatus("ready")
  }

  const runSearch = async (fen: string) => {
    const engine = engineRef.current
    const life = lifeRef.current
    if (!engine || lifeRef.current !== life) return

    searchFenRef.current = fen
    stopRequestedRef.current = false
    pvScoresRef.current = emptyScores()
    linesRef.current = new Map()
    depthRef.current = 0
    cachedDepthRef.current = 0
    dispatch({ type: "ENGINE_START_ANALYSIS" })

    const cached = analysisCache.get(fen, LIVE_MULTIPV)
    if (cached) {
      const final = cached.complete && cached.lines.length >= LIVE_MULTIPV
      for (const line of cached.lines) {
        linesRef.current.set(line.id, line)
        pvScoresRef.current[line.id] = line.score
      }
      depthRef.current = cached.depth
      cachedDepthRef.current = cached.depth
      dispatch({
        type: "ENGINE_SHOW_CACHED",
        depth: cached.depth,
        lines: cached.lines,
        final,
      })
      if (final) {
        completeSearch(fen, true)
        return
      }
    }

    setEngineStatus("analyzing")
    void engine
      .search(fen, LIVE_SEARCH, {
        onReady: () => {
          if (!errorRef.current || lifeRef.current !== life) return
          errorRef.current = null
          failedRef.current = false
          dispatch({ type: "ENGINE_READY" })
        },
        onInfo: (info) => {
          if (lifeRef.current !== life) return
          if (searchFenRef.current !== fenRef.current) return
          dispatch({ type: "ENGINE_OUTPUT", info })
          if (info.depth < cachedDepthRef.current) return
          pvScoresRef.current[info.multipv] = info.score
          linesRef.current.set(info.multipv, {
            id: info.multipv,
            score: info.score,
            pv: info.pv,
          })
          depthRef.current = Math.max(depthRef.current, info.depth)
          if (info.multipv === 1 && info.score) {
            latestEvalRef.current = info.score
          }
        },
        onDone: (result) => {
          if (lifeRef.current !== life) return
          applyResult(fen, result)
          completeSearch(fen, !stopRequestedRef.current)
        },
        onError: (error) => {
          if (lifeRef.current !== life) return
          if (stopRequestedRef.current && error.reason !== "timeout") {
            completeSearch(fen, false)
            return
          }
          if (error.reason === "terminated") return
          failRef.current(error)
        },
      })
      .catch(() => {})
  }

  const applyResult = (fen: string, result: SearchResult) => {
    const terminal = getTerminalScore(fen)
    if (terminal) {
      pvScoresRef.current[1] = terminal
      dispatch({ type: "ENGINE_TERMINAL_POSITION", score: terminal })
      return
    }
    if (stopRequestedRef.current || result.lines.length === 0) return
    linesRef.current = new Map(result.lines.map((line) => [line.id, line]))
    for (const line of result.lines) pvScoresRef.current[line.id] = line.score
    depthRef.current = result.depth
  }

  const requestAnalysis = (fen: string) => {
    const engine = engineRef.current
    if (!engine) {
      if (failedRef.current && statusRef.current === "idle") start()
      return
    }
    if (statusRef.current === "analyzing") {
      pendingFenRef.current = fen
      stopRequestedRef.current = true
      pausedRef.current = false
      engine.stop()
      return
    }
    void runSearchRef.current(fen)
  }

  const stop = useCallback(() => {
    lifeRef.current += 1
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    engineRef.current?.terminate()
    engineRef.current = null
    failedRef.current = false
    pendingFenRef.current = null
    pendingMoveRef.current = null
    pausedRef.current = false
    stopRequestedRef.current = false
    searchFenRef.current = null
    latestEvalRef.current = null
    pvScoresRef.current = emptyScores()
    setEngineStatus("idle")
    dispatch({ type: "ENGINE_LIVE_RESET" })
  }, [dispatch])

  const start = useCallback(() => {
    if (engineRef.current || statusRef.current === "initializing") return
    const life = lifeRef.current
    setEngineStatus("initializing")
    void UciEngine.start(
      () => new Worker(ENGINE_URL) as unknown as EngineWorker,
      {
        hashMb: HASH_MB,
        multiPv: LIVE_MULTIPV,
        startTimeoutMs: ENGINE_START_TIMEOUT_MS,
      },
      undefined,
      {
        onReady: (engine) => {
          if (lifeRef.current !== life) {
            engine.terminate()
            return
          }
          // A crashed worker handshakes again inside the search that replaces it.
          if (engineRef.current === engine) {
            if (!errorRef.current) return
            errorRef.current = null
            failedRef.current = false
            dispatch({ type: "ENGINE_READY" })
            return
          }
          engineRef.current = engine
          errorRef.current = null
          failedRef.current = false
          dispatch({ type: "ENGINE_READY" })
          setEngineStatus("ready")
          void runSearchRef.current(fenRef.current)
        },
        onFailure: (error) => {
          if (lifeRef.current !== life) return
          failRef.current(error)
        },
      }
    ).catch(() => {})
  }, [dispatch])

  useEffect(() => {
    const canSearch =
      statusRef.current === "ready" ||
      statusRef.current === "analyzing" ||
      (statusRef.current === "idle" && failedRef.current)
    if (!canSearch) return

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      requestRef.current(gameState.fen)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [gameState.fen])

  // A move played on the board, in the game or in a variation, is
  // classified once its position is analysed.
  useEffect(() => {
    const previous = previousGameRef.current
    const isOneNewMove =
      gameState.currentMoveIndex === previous.currentMoveIndex + 1 &&
      gameState.history.length === previous.history.length + 1
    // A new variation, or one extended by a move from its end.
    const previousVariationLength =
      previous.variationIndex !== null && previous.variation
        ? previous.variationIndex
        : 0
    const isNewVariationMove =
      gameState.variation !== null &&
      gameState.variationIndex !== null &&
      gameState.variationIndex === gameState.variation.moves.length &&
      gameState.variationIndex === previousVariationLength + 1 &&
      (previousVariationLength > 0 ||
        previous.currentMoveIndex === gameState.variation.branchIndex)

    if (isOneNewMove) {
      const moveIndex = gameState.currentMoveIndex
      const moveEntry = gameState.history[moveIndex - 1]
      if (moveEntry) {
        pendingMoveRef.current = {
          target: "main",
          moveIndex,
          fenBefore: previous.fen,
          fenAfter: moveEntry.fen,
          scoreBefore: latestEvalRef.current,
        }
      }
    } else if (isNewVariationMove) {
      const moveIndex = gameState.variationIndex!
      const moveEntry = gameState.variation!.moves[moveIndex - 1]
      if (moveEntry && !moveEntry.classification) {
        pendingMoveRef.current = {
          target: "variation",
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

  // Do not burn CPU (and battery) analysing in a background tab.
  useEffect(() => {
    const onVisibilityChange = () => {
      const engine = engineRef.current
      if (!engine) return

      if (document.hidden) {
        if (statusRef.current === "analyzing" && !stopRequestedRef.current) {
          pausedRef.current = true
          stopRequestedRef.current = true
          pendingFenRef.current = null
          engine.stop()
        }
      } else if (pausedRef.current) {
        pausedRef.current = false
        requestRef.current(fenRef.current)
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])

  useEffect(() => {
    failRef.current = failEngine
    runSearchRef.current = runSearch
    requestRef.current = requestAnalysis
    stopRef.current = stop
  })

  useEffect(() => {
    return () => {
      lifeRef.current += 1
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      engineRef.current?.terminate()
      engineRef.current = null
    }
  }, [])

  return {
    status,
    start,
    stop,
  }
}
