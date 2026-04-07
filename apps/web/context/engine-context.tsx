"use client"

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react"
import type { ParsedBestMove, ParsedInfoLine } from "@/lib/engine/types"

// ── Types ──

export type EngineScore =
  | { type: "cp"; value: number }
  | { type: "mate"; value: number }
  | null

export type EngineLine = {
  id: 1 | 2 | 3
  score: EngineScore
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

// ── Actions ──

export type EngineAction =
  | { type: "ENGINE_START_ANALYSIS" }
  | { type: "ENGINE_OUTPUT"; info: ParsedInfoLine }
  | { type: "ENGINE_BESTMOVE"; bestMove: ParsedBestMove }
  | { type: "ENGINE_RESET" }

// ── Reducer ──

function engineReducer(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case "ENGINE_START_ANALYSIS":
      return {
        ...state,
        isAnalyzing: true,
        depth: 0,
        nps: 0,
        pvLines: [],
        evaluation: null,
        bestMove: null,
      }

    case "ENGINE_OUTPUT": {
      const { info } = action
      const newLines = [...state.pvLines]
      const lineIndex = newLines.findIndex((l) => l.id === info.multipv)
      const newLine: EngineLine = { id: info.multipv, score: info.score, pv: info.pv }

      if (lineIndex >= 0) {
        newLines[lineIndex] = newLine
      } else {
        newLines.push(newLine)
        newLines.sort((a, b) => a.id - b.id)
      }

      return {
        ...state,
        depth: info.depth,
        nps: info.nps,
        evaluation:
          info.multipv === 1 && info.score ? info.score : state.evaluation,
        pvLines: newLines,
      }
    }

    case "ENGINE_BESTMOVE":
      return {
        ...state,
        bestMove: action.bestMove.move,
        isAnalyzing: false,
      }

    case "ENGINE_RESET":
      return initialEngineState
  }
}

// ── Context ──

type EngineContextValue = {
  state: EngineState
  dispatch: Dispatch<EngineAction>
}

const EngineContext = createContext<EngineContextValue | null>(null)

export function EngineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(engineReducer, initialEngineState)

  return (
    <EngineContext.Provider value={{ state, dispatch }}>
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
