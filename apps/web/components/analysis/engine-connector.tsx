"use client"

import { useEffect } from "react"
import { useEngineWorker } from "@/hooks/use-engine-worker"
import { useEngineContext } from "@/context/engine-context"
import { useUIContext } from "@/context/ui-context"

export function EngineConnector() {
  const { start, stop } = useEngineWorker()
  const { state: uiState } = useUIContext()
  const { state: engineState } = useEngineContext()

  useEffect(() => {
    if (uiState.engineEnabled) {
      start()
    } else {
      stop()
    }
  }, [uiState.engineEnabled, start, stop])

  useEffect(() => {
    if (!engineState.retryRequested || !uiState.engineEnabled) return
    stop()
    start()
  }, [engineState.retryRequested, uiState.engineEnabled, start, stop])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return null
}
