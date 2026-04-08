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
import type { ParsedGame } from "@/lib/chess/fen-pgn"

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
  initialFen: string
  fen: string
  pgn: string
  history: MoveEntry[]
  currentMoveIndex: number
  turn: "w" | "b"
  isGameOver: boolean
}

export const initialGameState: GameState = {
  initialFen: DEFAULT_POSITION,
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

function replayMoves(
  chess: Chess,
  moves: MoveEntry[],
  upTo: number,
  initialFen: string
) {
  chess.load(initialFen)
  for (let i = 0; i < upTo; i++) {
    chess.move(moves[i]!.san)
  }
}

function deriveState(
  chess: Chess,
  history: MoveEntry[],
  currentMoveIndex: number,
  initialFen: string
): GameState {
  return {
    initialFen,
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
  setPositionFromFen: (fen: string) => boolean
  loadPgnGame: (parsed: ParsedGame) => boolean
  undo: () => void
  goToMove: (index: number) => void
  newGame: () => void
  restoreState: (snapshot: GameState) => boolean
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
        replayMoves(chess, history, currentMoveIndex, state.initialFen)
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
          payload: deriveState(chess, newHistory, newIndex, state.initialFen),
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

  const setPositionFromFen = useCallback((fen: string): boolean => {
    const chess = chessRef.current
    try {
      chess.load(fen)
      dispatch({
        type: "SET_STATE",
        payload: deriveState(chess, [], 0, fen),
      })
      return true
    } catch {
      return false
    }
  }, [])

  const loadPgnGame = useCallback((parsed: ParsedGame): boolean => {
    const chess = chessRef.current

    try {
      chess.loadPgn(parsed.pgn)

      const history: MoveEntry[] = parsed.moves.map((move) => ({
        san: move.san,
        fen: move.fen,
        scoreBefore: null,
        scoreAfter: null,
        delta: null,
        classification: null,
      }))

      dispatch({
        type: "SET_STATE",
        payload: deriveState(chess, history, history.length, parsed.initialFen),
      })
      return true
    } catch {
      return false
    }
  }, [])

  const goToMove = useCallback(
    (index: number) => {
      const { history } = state
      const clamped = Math.max(0, Math.min(index, history.length))
      if (clamped === state.currentMoveIndex) return

      const chess = chessRef.current
      replayMoves(chess, history, clamped, state.initialFen)
      dispatch({
        type: "SET_STATE",
        payload: deriveState(chess, history, clamped, state.initialFen),
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

  const restoreState = useCallback((snapshot: GameState): boolean => {
    const chess = chessRef.current

    try {
      const clampedMoveIndex = Math.max(
        0,
        Math.min(snapshot.currentMoveIndex, snapshot.history.length)
      )

      replayMoves(
        chess,
        snapshot.history,
        clampedMoveIndex,
        snapshot.initialFen
      )

      dispatch({
        type: "SET_STATE",
        payload: deriveState(
          chess,
          snapshot.history,
          clampedMoveIndex,
          snapshot.initialFen
        ),
      })

      return true
    } catch {
      return false
    }
  }, [])

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      makeMove,
      annotateMove,
      setPositionFromFen,
      loadPgnGame,
      undo,
      goToMove,
      newGame,
      restoreState,
    }),
    [
      state,
      makeMove,
      annotateMove,
      setPositionFromFen,
      loadPgnGame,
      undo,
      goToMove,
      newGame,
      restoreState,
    ]
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
