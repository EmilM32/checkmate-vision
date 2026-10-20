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
import {
  EMPTY_GAME_META,
  type GameMeta,
  type ParsedGame,
} from "@/lib/chess/fen-pgn"

// ── Types ──

export type MoveEntry = {
  san: string
  fen: string
  scoreBefore: EngineScore
  scoreAfter: EngineScore
  delta: number | null
  classification: MoveClassification | null
  // Mover's remaining clock time in seconds (from PGN `[%clk]` comments).
  clock?: number | null
  // The engine's preferred move in the position before (UCI) and its score,
  // from game analysis.
  bestMove?: string | null
  bestScore?: EngineScore
}

export type MoveAnalysisPatch = {
  scoreBefore: EngineScore
  scoreAfter: EngineScore
  delta: number | null
  classification: MoveClassification | null
  bestMove?: string | null
  bestScore?: EngineScore
}

// A side line played from the main line: its moves follow the first
// `branchIndex` moves of the game. One variation is kept at a time.
export type Variation = {
  branchIndex: number
  moves: MoveEntry[]
}

export type GameState = {
  initialFen: string
  fen: string
  pgn: string
  // The main line (the loaded or played game).
  history: MoveEntry[]
  // Position on the main line; while in a variation, its branch point.
  currentMoveIndex: number
  turn: "w" | "b"
  isGameOver: boolean
  meta: GameMeta
  variation: Variation | null
  // Variation moves shown on the board, or null while on the main line.
  variationIndex: number | null
}

export const initialGameState: GameState = {
  initialFen: DEFAULT_POSITION,
  fen: DEFAULT_POSITION,
  pgn: "",
  history: [],
  currentMoveIndex: 0,
  turn: "w",
  isGameOver: false,
  meta: EMPTY_GAME_META,
  variation: null,
  variationIndex: null,
}

/** The moves leading to the shown position, main line or variation. */
export function getCurrentLine(state: GameState): MoveEntry[] {
  const { history, currentMoveIndex, variation, variationIndex } = state
  if (variation && variationIndex !== null) {
    return [
      ...history.slice(0, variation.branchIndex),
      ...variation.moves.slice(0, variationIndex),
    ]
  }
  return history.slice(0, currentMoveIndex)
}

function newMoveEntry(san: string, fen: string): MoveEntry {
  return {
    san,
    fen,
    scoreBefore: null,
    scoreAfter: null,
    delta: null,
    classification: null,
  }
}

// ── Reducer ──

type GameAction =
  | { type: "SET_STATE"; payload: GameState }
  | {
      type: "ANNOTATE_MOVE"
      index: number
      patch: MoveAnalysisPatch
      expectedFen?: string
    }
  | {
      type: "ANNOTATE_VARIATION_MOVE"
      index: number
      patch: MoveAnalysisPatch
      expectedFen: string
    }

// Annotations arrive asynchronously from the engine, sometimes several before
// React re-renders, so they are applied to the latest state in the reducer.
function annotateHistory(
  state: GameState,
  index: number,
  patch: MoveAnalysisPatch,
  expectedFen?: string
): GameState {
  const move = state.history[index - 1]
  if (!move) return state
  // Analysis computed for a position that is no longer at this index
  // (the game changed meanwhile) must not be attached to another move.
  if (expectedFen !== undefined && move.fen !== expectedFen) return state

  const history = [...state.history]
  history[index - 1] = { ...move, ...patch }
  return { ...state, history }
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_STATE":
      return action.payload
    case "ANNOTATE_MOVE":
      return annotateHistory(
        state,
        action.index,
        action.patch,
        action.expectedFen
      )
    case "ANNOTATE_VARIATION_MOVE": {
      const { variation } = state
      const move = variation?.moves[action.index - 1]
      // The variation may have been replaced while the engine searched.
      if (!variation || !move || move.fen !== action.expectedFen) return state
      const moves = [...variation.moves]
      moves[action.index - 1] = { ...move, ...action.patch }
      return { ...state, variation: { ...variation, moves } }
    }
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

type Line = Pick<
  GameState,
  | "history"
  | "currentMoveIndex"
  | "initialFen"
  | "meta"
  | "variation"
  | "variationIndex"
>

// Replays the shown line on `chess` and derives the full state from it.
function deriveState(chess: Chess, line: Line): GameState {
  const shown = getCurrentLine({ ...initialGameState, ...line })
  replayMoves(chess, shown, shown.length, line.initialFen)
  return {
    ...line,
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: chess.turn(),
    isGameOver: chess.isGameOver(),
  }
}

// ── Context ──

type GameContextValue = {
  state: GameState
  makeMove: (from: string, to: string, promotion?: string) => boolean
  annotateMove: (
    index: number,
    patch: MoveAnalysisPatch,
    expectedFen?: string
  ) => void
  annotateVariationMove: (
    index: number,
    patch: MoveAnalysisPatch,
    expectedFen: string
  ) => void
  setPositionFromFen: (fen: string) => boolean
  loadPgnGame: (parsed: ParsedGame) => boolean
  undo: () => void
  // Main-line position; leaves a variation (which stays listed).
  goToMove: (index: number) => void
  goToVariationMove: (index: number) => void
  stepForward: () => void
  stepBack: () => void
  goToEnd: () => void
  deleteVariation: () => void
  // Starts a variation with a UCI move from main-line position `branchIndex`.
  startVariation: (branchIndex: number, uci: string) => boolean
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
      const { history, currentMoveIndex, variation, variationIndex } = state
      const inVariation = variation !== null && variationIndex !== null

      // The board shows the current line; make sure chess.js does too.
      const line = getCurrentLine(state)
      replayMoves(chess, line, line.length, state.initialFen)

      let move
      try {
        move = chess.move({ from, to, promotion })
      } catch {
        return false
      }
      const entry = newMoveEntry(move.san, move.after)
      const base = {
        history,
        currentMoveIndex,
        initialFen: state.initialFen,
        meta: state.meta,
        variation,
        variationIndex,
      }

      let next: Line
      if (inVariation) {
        // Extend the variation; moves after the shown one are replaced.
        const moves = [...variation.moves.slice(0, variationIndex), entry]
        next = {
          ...base,
          variation: { branchIndex: variation.branchIndex, moves },
          variationIndex: moves.length,
        }
      } else if (currentMoveIndex === history.length) {
        // At the end of the game: the move continues the main line, and the
        // loaded game's result no longer applies.
        next = {
          ...base,
          history: [...history, entry],
          currentMoveIndex: history.length + 1,
          meta: { ...state.meta, result: null },
        }
      } else if (history[currentMoveIndex]?.san === move.san) {
        // The game's own move: just step forward.
        next = { ...base, currentMoveIndex: currentMoveIndex + 1 }
      } else {
        // A different move mid-game starts a variation; the game is kept.
        next = {
          ...base,
          variation: { branchIndex: currentMoveIndex, moves: [entry] },
          variationIndex: 1,
        }
      }

      dispatch({ type: "SET_STATE", payload: deriveState(chess, next) })
      return true
    },
    [state]
  )

  const annotateMove = useCallback(
    (index: number, patch: MoveAnalysisPatch, expectedFen?: string) => {
      dispatch({ type: "ANNOTATE_MOVE", index, patch, expectedFen })
    },
    []
  )

  const annotateVariationMove = useCallback(
    (index: number, patch: MoveAnalysisPatch, expectedFen: string) => {
      dispatch({ type: "ANNOTATE_VARIATION_MOVE", index, patch, expectedFen })
    },
    []
  )

  const setPositionFromFen = useCallback((fen: string): boolean => {
    const chess = chessRef.current
    try {
      chess.load(fen)
      dispatch({
        type: "SET_STATE",
        payload: deriveState(chess, {
          history: [],
          currentMoveIndex: 0,
          initialFen: chess.fen(),
          meta: EMPTY_GAME_META,
          variation: null,
          variationIndex: null,
        }),
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
        clock: move.clock,
      }))

      dispatch({
        type: "SET_STATE",
        payload: deriveState(chess, {
          history,
          currentMoveIndex: history.length,
          initialFen: parsed.initialFen,
          meta: parsed.meta,
          variation: null,
          variationIndex: null,
        }),
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
      if (clamped === state.currentMoveIndex && state.variationIndex === null) {
        return
      }

      dispatch({
        type: "SET_STATE",
        payload: deriveState(chessRef.current, {
          ...state,
          currentMoveIndex: clamped,
          variationIndex: null,
        }),
      })
    },
    [state]
  )

  const goToVariationMove = useCallback(
    (index: number) => {
      const { variation } = state
      if (!variation) return
      // Variation move 0 is its branch point on the main line.
      if (index <= 0) {
        goToMove(variation.branchIndex)
        return
      }
      const clamped = Math.min(index, variation.moves.length)
      if (clamped === state.variationIndex) return

      dispatch({
        type: "SET_STATE",
        payload: deriveState(chessRef.current, {
          ...state,
          currentMoveIndex: variation.branchIndex,
          variationIndex: clamped,
        }),
      })
    },
    [state, goToMove]
  )

  const stepForward = useCallback(() => {
    if (state.variationIndex !== null) {
      goToVariationMove(state.variationIndex + 1)
    } else {
      goToMove(state.currentMoveIndex + 1)
    }
  }, [
    state.variationIndex,
    state.currentMoveIndex,
    goToMove,
    goToVariationMove,
  ])

  const stepBack = useCallback(() => {
    if (state.variationIndex !== null) {
      goToVariationMove(state.variationIndex - 1)
    } else {
      goToMove(state.currentMoveIndex - 1)
    }
  }, [
    state.variationIndex,
    state.currentMoveIndex,
    goToMove,
    goToVariationMove,
  ])

  // The end of the line being browsed.
  const goToEnd = useCallback(() => {
    if (state.variation && state.variationIndex !== null) {
      goToVariationMove(state.variation.moves.length)
    } else {
      goToMove(state.history.length)
    }
  }, [state, goToMove, goToVariationMove])

  const deleteVariation = useCallback(() => {
    const { variation } = state
    if (!variation) return
    dispatch({
      type: "SET_STATE",
      payload: deriveState(chessRef.current, {
        ...state,
        currentMoveIndex:
          state.variationIndex !== null
            ? variation.branchIndex
            : state.currentMoveIndex,
        variation: null,
        variationIndex: null,
      }),
    })
  }, [state])

  const startVariation = useCallback(
    (branchIndex: number, uci: string): boolean => {
      const chess = chessRef.current
      const { history } = state
      if (branchIndex < 0 || branchIndex > history.length) return false

      replayMoves(chess, history, branchIndex, state.initialFen)
      let move
      try {
        move = chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci[4],
        })
      } catch {
        return false
      }

      dispatch({
        type: "SET_STATE",
        payload: deriveState(chess, {
          ...state,
          currentMoveIndex: branchIndex,
          variation: {
            branchIndex,
            moves: [newMoveEntry(move.san, move.after)],
          },
          variationIndex: 1,
        }),
      })
      return true
    },
    [state]
  )

  const undo = useCallback(() => {
    stepBack()
  }, [stepBack])

  const newGame = useCallback(() => {
    chessRef.current.reset()
    dispatch({ type: "SET_STATE", payload: initialGameState })
  }, [])

  const restoreState = useCallback((snapshot: GameState): boolean => {
    try {
      const clampedMoveIndex = Math.max(
        0,
        Math.min(snapshot.currentMoveIndex, snapshot.history.length)
      )
      // Sessions saved before variations existed have none.
      const variation =
        snapshot.variation &&
        snapshot.variation.branchIndex <= snapshot.history.length
          ? snapshot.variation
          : null
      const variationIndex =
        variation && snapshot.variationIndex !== null
          ? Math.max(
              1,
              Math.min(snapshot.variationIndex ?? 0, variation.moves.length)
            )
          : null

      dispatch({
        type: "SET_STATE",
        payload: deriveState(chessRef.current, {
          history: snapshot.history,
          currentMoveIndex:
            variation && variationIndex !== null
              ? variation.branchIndex
              : clampedMoveIndex,
          initialFen: snapshot.initialFen,
          // Sessions saved before game metadata existed have no `meta`.
          meta: snapshot.meta ?? EMPTY_GAME_META,
          variation,
          variationIndex: variation ? variationIndex : null,
        }),
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
      annotateVariationMove,
      setPositionFromFen,
      loadPgnGame,
      undo,
      goToMove,
      goToVariationMove,
      stepForward,
      stepBack,
      goToEnd,
      deleteVariation,
      startVariation,
      newGame,
      restoreState,
    }),
    [
      state,
      makeMove,
      annotateMove,
      annotateVariationMove,
      setPositionFromFen,
      loadPgnGame,
      undo,
      goToMove,
      goToVariationMove,
      stepForward,
      stepBack,
      goToEnd,
      deleteVariation,
      startVariation,
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
