"use client"

export type EngineWorkerStatus = "idle" | "initializing" | "ready" | "analyzing"

export function useEngineWorker() {
  return {
    status: "idle" as EngineWorkerStatus,
    start: () => {
      // TODO: connect Stockfish worker lifecycle.
    },
    stop: () => {
      // TODO: stop current analysis.
    },
  }
}
