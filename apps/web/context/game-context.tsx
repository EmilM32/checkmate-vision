"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react"
import { Chess, DEFAULT_POSITION } from "chess.js"
import type { EngineScore } from "@/context/engine-context"
import type { MoveClassification } from "@/lib/chess/classification"

// ── Types ──

export type MoveEntry = {
  san: string
  fen: string
  scoreBefore: EngineScore
  scoreAfter: EngineScore
  delta: number | null
  classification: MoveClassification | null
}

export type MoveAnalysisPatch = {
  scoreBefore: EngineScore
  scoreAfter: EngineScore
  delta: number | null
  classification: MoveClassification | null
}

export type GameState = {
  fen: string
  pgn: string
  history: MoveEntry[]
  currentMoveIndex: number
  turn: "w" | "b"
  isGameOver: boolean
}

export const initialGameState: GameState = {
  fen: DEFAULT_POSITION,
  pgn: "",
  history: [],
  currentMoveIndex: 0,
  turn: "w",
  isGameOver: false,
}

// ── Reducer ──

type GameAction = { type: "SET_STATE"; payload: GameState }

function gameReducer(_state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_STATE":
      return action.payload
  }
}

// ── Helpers ──

function replayMoves(chess: Chess, moves: MoveEntry[], upTo: number) {
  chess.reset()
  for (let i = 0; i < upTo; i++) {
    chess.move(moves[i]!.san)
  }
}

function deriveState(
  chess: Chess,
  history: MoveEntry[],
  currentMoveIndex: number
): GameState {
  return {
    fen: chess.fen(),
    pgn: chess.pgn(),
    history,
    currentMoveIndex,
    turn: chess.turn(),
    isGameOver: chess.isGameOver(),
  }
}

// ── Context ──

type GameContextValue = {
  state: GameState
  makeMove: (from: string, to: string, promotion?: string) => boolean
  annotateMove: (index: number, patch: MoveAnalysisPatch) => void
  undo: () => void
  goToMove: (index: number) => void
  newGame: () => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const chessRef = useRef(new Chess())
  const [state, dispatch] = useReducer(gameReducer, initialGameState)

  const makeMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const chess = chessRef.current
      let { history, currentMoveIndex } = state

      // If navigated back, truncate future moves and rebuild chess state
      if (currentMoveIndex < history.length) {
        history = history.slice(0, currentMoveIndex)
        replayMoves(chess, history, currentMoveIndex)
      }

      try {
        const move = chess.move({ from, to, promotion })
        const newHistory = [
          ...history,
          {
            san: move.san,
            fen: move.after,
            scoreBefore: null,
            scoreAfter: null,
            delta: null,
            classification: null,
          },
        ]
        const newIndex = newHistory.length
        dispatch({
          type: "SET_STATE",
          payload: deriveState(chess, newHistory, newIndex),
        })
        return true
      } catch {
        return false
      }
    },
    [state]
  )

  const annotateMove = useCallback(
    (index: number, patch: MoveAnalysisPatch) => {
      const { history, currentMoveIndex } = state
      if (index < 1 || index > history.length) return

      const historyIndex = index - 1
      const move = history[historyIndex]
      if (!move) return

      const nextHistory = [...history]
      nextHistory[historyIndex] = {
        ...move,
        ...patch,
      }

      dispatch({
        type: "SET_STATE",
        payload: {
          ...state,
          history: nextHistory,
          currentMoveIndex,
        },
      })
    },
    [state]
  )

  const goToMove = useCallback(
    (index: number) => {
      const { history } = state
      const clamped = Math.max(0, Math.min(index, history.length))
      if (clamped === state.currentMoveIndex) return

      const chess = chessRef.current
      replayMoves(chess, history, clamped)
      dispatch({
        type: "SET_STATE",
        payload: deriveState(chess, history, clamped),
      })
    },
    [state]
  )

  const undo = useCallback(() => {
    if (state.currentMoveIndex === 0) return
    goToMove(state.currentMoveIndex - 1)
  }, [state.currentMoveIndex, goToMove])

  const newGame = useCallback(() => {
    chessRef.current.reset()
    dispatch({ type: "SET_STATE", payload: initialGameState })
  }, [])

  const value = useMemo<GameContextValue>(
    () => ({ state, makeMove, annotateMove, undo, goToMove, newGame }),
    [state, makeMove, annotateMove, undo, goToMove, newGame]
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGameContext() {
  const context = useContext(GameContext)

  if (!context) {
    throw new Error("useGameContext must be used within GameProvider")
  }

  return context
}
