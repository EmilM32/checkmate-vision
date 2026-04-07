"use client"

import { useEffect } from "react"
import { useEngineWorker } from "@/hooks/use-engine-worker"

export function EngineConnector() {
  const { start, stop } = useEngineWorker()

  useEffect(() => {
    start()
    return () => stop()
  }, [start, stop])

  return null
}
