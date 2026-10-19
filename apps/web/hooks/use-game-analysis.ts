"use client"

import { useEffect, useRef } from "react"

import { useEngineContext } from "@/context/engine-context"
import { useGameContext } from "@/context/game-context"
import type { BatchAnalysisItem } from "@/context/engine-context"
import { buildMoveAnalysis, getPvGapCp } from "@/lib/chess/move-analysis"
import { analysisCache } from "@/lib/engine/analysis-cache"
import { ENGINE_URL } from "@/lib/engine/engine-url"
import {
  analyzeGamePositions,
  getGameAnalysisConcurrency,
} from "@/lib/engine/game-analysis"
import {
  EngineFailure,
  UciEngine,
  type EngineWorker,
  type SearchResult,
} from "@/lib/engine/uci-engine"

// Two lines are enough for the gap that marks "great" moves; the time cap
// bounds a whole game (endgames otherwise take 10+ s per position).
const GAME_SEARCH = { depth: 18, movetimeMs: 1_500 }
const GAME_ENGINE_OPTIONS = {
  hashMb: 16,
  multiPv: 2,
  startTimeoutMs: 20_000,
}

function startGameEngine(signal: AbortSignal) {
  return UciEngine.start(
    () => new Worker(ENGINE_URL) as unknown as EngineWorker,
    GAME_ENGINE_OPTIONS,
    signal
  )
}

/**
 * Runs game ("batch") analysis requested through the engine context in a
 * pool of workers, separate from the live engine, and annotates each move
 * as soon as the positions before and after it are analysed.
 */
export function useGameAnalysis() {
  const { state: engineState, dispatch } = useEngineContext()
  const { annotateMove } = useGameContext()
  const { requestId, queue, cancelRequested } = engineState.batch

  const annotateMoveRef = useRef(annotateMove)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    annotateMoveRef.current = annotateMove
  }, [annotateMove])

  // A new request starts a run; clearing or resetting the batch (requestId
  // back to 0 or replaced) aborts the previous one.
  useEffect(() => {
    if (requestId === 0 || queue.length === 0) return

    const controller = new AbortController()
    abortRef.current = controller

    const items = [...queue].sort((a, b) => a.moveIndex - b.moveIndex)
    const byMoveIndex = new Map(items.map((item) => [item.moveIndex, item]))
    const results = new Map<number, SearchResult>()
    let completed = 0

    // Move N is judged by the positions before (N-1) and after (N) it.
    const annotate = (moveIndex: number) => {
      const item = byMoveIndex.get(moveIndex)
      const after = results.get(moveIndex)
      const before = results.get(moveIndex - 1)
      if (!item || moveIndex === 0 || !after || !before) return

      annotateMoveRef.current(
        moveIndex,
        buildMoveAnalysis({
          ply: moveIndex,
          fenBefore: item.fenBefore,
          fenAfter: item.fen,
          scoreBefore: before.scores[1],
          scoreAfter: after.scores[1],
          pvGapCp: getPvGapCp(after.scores[1], after.scores[2]),
        }),
        item.fen
      )
    }

    const onPosition = (item: BatchAnalysisItem, result: SearchResult) => {
      results.set(item.moveIndex, result)
      // Lets the live view show these lines at once while browsing the game.
      analysisCache.set(item.fen, {
        depth: result.depth,
        lines: result.lines,
        complete: false,
      })
      annotate(item.moveIndex)
      annotate(item.moveIndex + 1)
      completed += 1
      dispatch({
        type: "ENGINE_BATCH_PROGRESS",
        completed,
        currentMoveIndex: item.moveIndex,
      })
    }

    analyzeGamePositions({
      items,
      concurrency: getGameAnalysisConcurrency(
        typeof navigator === "undefined"
          ? undefined
          : navigator.hardwareConcurrency
      ),
      limits: GAME_SEARCH,
      startEngine: startGameEngine,
      signal: controller.signal,
      onPosition,
    })
      .then(() => {
        if (abortRef.current !== controller) return
        dispatch({
          type: controller.signal.aborted
            ? "ENGINE_BATCH_CANCELLED"
            : "ENGINE_BATCH_DONE",
        })
      })
      .catch((error: unknown) => {
        if (abortRef.current !== controller || controller.signal.aborted) {
          return
        }
        console.error("Game analysis failed:", error)
        dispatch({
          type: "ENGINE_BATCH_ERROR",
          error:
            error instanceof EngineFailure && error.reason === "load"
              ? "errors.engineLoadFailed"
              : "errors.engineCrashed",
        })
      })
      .finally(() => {
        if (abortRef.current === controller) abortRef.current = null
      })

    return () => {
      controller.abort()
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [requestId, queue, dispatch])

  useEffect(() => {
    if (!cancelRequested) return
    if (abortRef.current) {
      // The run resolves after its searches stop and reports the cancel.
      abortRef.current.abort()
    } else {
      dispatch({ type: "ENGINE_BATCH_CANCELLED" })
    }
  }, [cancelRequested, dispatch])
}
