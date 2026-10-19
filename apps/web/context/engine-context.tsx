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
  // Depth of cached lines on display; live output below it is not shown,
  // so a fresh search does not replace deep cached lines with shallow ones.
  cachedDepth: number
  guessRevealed: boolean
  batch: BatchAnalysisState
  // i18n key of the last engine failure (load timeout, worker crash).
  error: string | null
  retryRequested: boolean
}

// Only user choices are persisted: engine output is recomputed as soon as
// the engine runs again, and a persisted batch could not resume anyway.
export type PersistableEngineState = Pick<EngineState, "guessRevealed">

export const initialEngineState: EngineState = {
  evaluation: null,
  depth: 0,
  nps: 0,
  bestMove: null,
  pvLines: [],
  isAnalyzing: false,
  cachedDepth: 0,
  guessRevealed: false,
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
  error: null,
  retryRequested: false,
}

// ── Actions ──

export type EngineAction =
  | { type: "ENGINE_START_ANALYSIS" }
  | { type: "ENGINE_OUTPUT"; info: ParsedInfoLine }
  | { type: "ENGINE_BESTMOVE"; bestMove: ParsedBestMove }
  | { type: "ENGINE_TERMINAL_POSITION"; score: EngineScore }
  | {
      type: "ENGINE_SHOW_CACHED"
      depth: number
      lines: EngineLine[]
      // The cached search is final; no live search follows.
      final: boolean
    }
  | { type: "ENGINE_READY" }
  | { type: "ENGINE_ERROR"; error: string }
  | { type: "ENGINE_RETRY_REQUEST" }
  | { type: "ENGINE_REVEAL_ANALYSIS" }
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
  | { type: "ENGINE_LIVE_RESET" }
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
        cachedDepth: 0,
        guessRevealed: false,
      }

    case "ENGINE_OUTPUT": {
      const { info } = action
      if (info.depth < state.cachedDepth) {
        return { ...state, nps: info.nps }
      }

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
        info.multipv === 1 && info.score && info.depth >= MIN_EVAL_DISPLAY_DEPTH

      return {
        ...state,
        depth: info.depth,
        nps: info.nps,
        evaluation: shouldUpdateEval ? info.score : state.evaluation,
        pvLines: newLines,
      }
    }

    case "ENGINE_SHOW_CACHED":
      return {
        ...state,
        depth: action.depth,
        nps: 0,
        pvLines: action.lines,
        evaluation: action.lines[0]?.score ?? state.evaluation,
        bestMove: action.lines[0]?.pv[0] ?? null,
        isAnalyzing: !action.final,
        cachedDepth: action.depth,
      }

    case "ENGINE_TERMINAL_POSITION":
      return {
        ...state,
        evaluation: action.score,
        depth: 0,
        nps: 0,
        pvLines: [],
        bestMove: null,
      }

    case "ENGINE_READY":
      return { ...state, error: null, retryRequested: false }

    case "ENGINE_ERROR":
      return {
        ...state,
        error: action.error,
        isAnalyzing: false,
        retryRequested: false,
      }

    case "ENGINE_RETRY_REQUEST":
      return { ...state, retryRequested: true }

    case "ENGINE_BESTMOVE":
      return {
        ...state,
        bestMove: action.bestMove.move,
        isAnalyzing: false,
      }

    case "ENGINE_REVEAL_ANALYSIS":
      return {
        ...state,
        guessRevealed: true,
      }

    case "ENGINE_CONCEAL_ANALYSIS":
      return {
        ...state,
        guessRevealed: false,
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
      // Sessions saved by earlier versions also carry engine output; ignore it.
      return {
        ...state,
        guessRevealed: action.payload.guessRevealed === true,
        isAnalyzing: false,
      }

    case "ENGINE_LIVE_RESET":
      // The live engine stopped; game analysis runs in its own workers and
      // carries on. Keep the failure visible until the engine starts again.
      return {
        ...initialEngineState,
        batch: state.batch,
        error: state.error,
      }

    case "ENGINE_RESET":
      // Keep the failure visible until the engine starts successfully.
      return { ...initialEngineState, error: state.error }
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
