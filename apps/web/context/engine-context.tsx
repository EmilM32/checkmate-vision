"use client"

import { createContext, useContext, type ReactNode } from "react"

export type EngineScore =
  | { type: "cp"; value: number }
  | { type: "mate"; value: number }
  | null

export type EngineLine = {
  id: 1 | 2 | 3
  pv: string[]
}

export type EngineState = {
  evaluation: EngineScore
  depth: number
  nps: number
  bestMove: string | null
  pvLines: EngineLine[]
  isAnalyzing: boolean
  sleuthRevealed: boolean
}

export const initialEngineState: EngineState = {
  evaluation: null,
  depth: 0,
  nps: 0,
  bestMove: null,
  pvLines: [],
  isAnalyzing: false,
  sleuthRevealed: false,
}

type EngineContextValue = {
  state: EngineState
}

const EngineContext = createContext<EngineContextValue | null>(null)

export function EngineProvider({ children }: { children: ReactNode }) {
  return (
    <EngineContext.Provider value={{ state: initialEngineState }}>
      {children}
    </EngineContext.Provider>
  )
}

export function useEngineContext() {
  const context = useContext(EngineContext)

  if (!context) {
    throw new Error("useEngineContext must be used within EngineProvider")
  }

  return context
}
