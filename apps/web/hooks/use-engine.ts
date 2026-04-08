"use client"

import { useEngineContext } from "@/context"
import type { BatchAnalysisItem } from "@/context/engine-context"

export function useEngine() {
  const { state, dispatch } = useEngineContext()

  const requestBatchAnalysis = (queue: BatchAnalysisItem[]) => {
    dispatch({
      type: "ENGINE_BATCH_REQUEST",
      requestId: Date.now(),
      queue,
    })
  }

  const cancelBatchAnalysis = () => {
    if (state.batch.status !== "running") return
    dispatch({ type: "ENGINE_BATCH_CANCEL_REQUEST" })
  }

  const clearBatchAnalysis = () => {
    dispatch({ type: "ENGINE_BATCH_CLEAR" })
  }

  const revealAnalysis = () => {
    dispatch({ type: "REVEAL_ANALYSIS" })
  }

  const concealAnalysis = () => {
    dispatch({ type: "ENGINE_CONCEAL_ANALYSIS" })
  }

  return {
    state,
    requestBatchAnalysis,
    cancelBatchAnalysis,
    clearBatchAnalysis,
    revealAnalysis,
    concealAnalysis,
  }
}
