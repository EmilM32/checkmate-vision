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

export type BatchAnalysisItem = {
  moveIndex: number
  fen: string
  fenBefore: string
}

export type BatchAnalysisStatus =
  | "idle"
  | "running"
  | "done"
  | "cancelled"
  | "error"

export type BatchAnalysisState = {
  requestId: number
  queue: BatchAnalysisItem[]
  total: number
  completed: number
  currentMoveIndex: number | null
  status: BatchAnalysisStatus
  cancelRequested: boolean
  lastError: string | null
}

export type EngineState = {
  evaluation: EngineScore
  depth: number
  nps: number
  bestMove: string | null
  pvLines: EngineLine[]
  isAnalyzing: boolean
  sleuthRevealed: boolean
  batch: BatchAnalysisState
}

export type PersistableEngineState = Pick<
  EngineState,
  | "evaluation"
  | "depth"
  | "nps"
  | "bestMove"
  | "pvLines"
  | "sleuthRevealed"
  | "batch"
>

export const initialEngineState: EngineState = {
  evaluation: null,
  depth: 0,
  nps: 0,
  bestMove: null,
  pvLines: [],
  isAnalyzing: false,
  sleuthRevealed: false,
  batch: {
    requestId: 0,
    queue: [],
    total: 0,
    completed: 0,
    currentMoveIndex: null,
    status: "idle",
    cancelRequested: false,
    lastError: null,
  },
}

// ── Actions ──

export type EngineAction =
  | { type: "ENGINE_START_ANALYSIS" }
  | { type: "ENGINE_OUTPUT"; info: ParsedInfoLine }
  | { type: "ENGINE_BESTMOVE"; bestMove: ParsedBestMove }
  | { type: "REVEAL_ANALYSIS" }
  | { type: "ENGINE_CONCEAL_ANALYSIS" }
  | {
      type: "ENGINE_BATCH_REQUEST"
      requestId: number
      queue: BatchAnalysisItem[]
    }
  | {
      type: "ENGINE_BATCH_PROGRESS"
      completed: number
      currentMoveIndex: number | null
    }
  | { type: "ENGINE_BATCH_DONE" }
  | { type: "ENGINE_BATCH_CANCEL_REQUEST" }
  | { type: "ENGINE_BATCH_CANCELLED" }
  | { type: "ENGINE_BATCH_ERROR"; error: string }
  | { type: "ENGINE_BATCH_CLEAR" }
  | { type: "ENGINE_RESTORE_STATE"; payload: PersistableEngineState }
  | { type: "ENGINE_RESET" }

// ── Constants ──

const MIN_EVAL_DISPLAY_DEPTH = 8

// ── Reducer ──

export function engineReducer(
  state: EngineState,
  action: EngineAction
): EngineState {
  switch (action.type) {
    case "ENGINE_START_ANALYSIS":
      return {
        ...state,
        isAnalyzing: true,
        depth: 0,
        nps: 0,
        pvLines: [],
        bestMove: null,
        sleuthRevealed: false,
      }

    case "ENGINE_OUTPUT": {
      const { info } = action
      const newLines = [...state.pvLines]
      const lineIndex = newLines.findIndex((l) => l.id === info.multipv)
      const newLine: EngineLine = {
        id: info.multipv,
        score: info.score,
        pv: info.pv,
      }

      if (lineIndex >= 0) {
        newLines[lineIndex] = newLine
      } else {
        newLines.push(newLine)
        newLines.sort((a, b) => a.id - b.id)
      }

      const shouldUpdateEval =
        info.multipv === 1 &&
        info.score &&
        info.depth >= MIN_EVAL_DISPLAY_DEPTH

      return {
        ...state,
        depth: info.depth,
        nps: info.nps,
        evaluation: shouldUpdateEval ? info.score : state.evaluation,
        pvLines: newLines,
      }
    }

    case "ENGINE_BESTMOVE":
      return {
        ...state,
        bestMove: action.bestMove.move,
        isAnalyzing: false,
      }

    case "REVEAL_ANALYSIS":
      return {
        ...state,
        sleuthRevealed: true,
      }

    case "ENGINE_CONCEAL_ANALYSIS":
      return {
        ...state,
        sleuthRevealed: false,
      }

    case "ENGINE_BATCH_REQUEST":
      return {
        ...state,
        batch: {
          requestId: action.requestId,
          queue: action.queue,
          total: action.queue.length,
          completed: 0,
          currentMoveIndex: null,
          status: action.queue.length > 0 ? "running" : "idle",
          cancelRequested: false,
          lastError: null,
        },
      }

    case "ENGINE_BATCH_PROGRESS":
      return {
        ...state,
        batch: {
          ...state.batch,
          completed: action.completed,
          currentMoveIndex: action.currentMoveIndex,
          status: "running",
        },
      }

    case "ENGINE_BATCH_DONE":
      return {
        ...state,
        batch: {
          ...state.batch,
          completed: state.batch.total,
          currentMoveIndex: null,
          status: "done",
          cancelRequested: false,
        },
      }

    case "ENGINE_BATCH_CANCEL_REQUEST":
      return {
        ...state,
        batch: {
          ...state.batch,
          cancelRequested: true,
        },
      }

    case "ENGINE_BATCH_CANCELLED":
      return {
        ...state,
        batch: {
          ...state.batch,
          currentMoveIndex: null,
          status: "cancelled",
          cancelRequested: false,
        },
      }

    case "ENGINE_BATCH_ERROR":
      return {
        ...state,
        batch: {
          ...state.batch,
          currentMoveIndex: null,
          status: "error",
          cancelRequested: false,
          lastError: action.error,
        },
      }

    case "ENGINE_BATCH_CLEAR":
      return {
        ...state,
        batch: {
          requestId: 0,
          queue: [],
          total: 0,
          completed: 0,
          currentMoveIndex: null,
          status: "idle",
          cancelRequested: false,
          lastError: null,
        },
      }

    case "ENGINE_RESTORE_STATE":
      return {
        ...state,
        ...action.payload,
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
