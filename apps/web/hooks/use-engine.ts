"use client"

import { useEngineContext } from "@/context"
import type {
  BatchAnalysisItem,
  PersistableEngineState,
} from "@/context/engine-context"

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

  const restoreEngineState = (payload: PersistableEngineState) => {
    dispatch({ type: "ENGINE_RESTORE_STATE", payload })
  }

  const resetEngine = () => {
    dispatch({ type: "ENGINE_RESET" })
  }

  return {
    state,
    requestBatchAnalysis,
    cancelBatchAnalysis,
    clearBatchAnalysis,
    revealAnalysis,
    concealAnalysis,
    restoreEngineState,
    resetEngine,
  }
}
