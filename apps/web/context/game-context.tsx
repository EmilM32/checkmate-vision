"use client"

import { createContext, useContext, type ReactNode } from "react"

export type GameState = {
  fen: string
  pgn: string
  history: string[]
  currentMoveIndex: number
}

export const initialGameState: GameState = {
  fen: "startpos",
  pgn: "",
  history: [],
  currentMoveIndex: 0,
}

type GameContextValue = {
  state: GameState
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  return (
    <GameContext.Provider value={{ state: initialGameState }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGameContext() {
  const context = useContext(GameContext)

  if (!context) {
    throw new Error("useGameContext must be used within GameProvider")
  }

  return context
}
