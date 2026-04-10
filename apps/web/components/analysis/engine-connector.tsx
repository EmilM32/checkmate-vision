"use client"

import { useEffect } from "react"
import { useEngineWorker } from "@/hooks/use-engine-worker"
import { useUIContext } from "@/context/ui-context"

export function EngineConnector() {
  const { start, stop } = useEngineWorker()
  const { state: uiState } = useUIContext()

  useEffect(() => {
    if (uiState.engineEnabled) {
      start()
    } else {
      stop()
    }
  }, [uiState.engineEnabled, start, stop])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return null
}
