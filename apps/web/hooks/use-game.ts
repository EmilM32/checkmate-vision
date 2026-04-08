"use client"

import { useGameContext } from "@/context"

export function useGame() {
  const {
    state,
    makeMove,
    annotateMove,
    setPositionFromFen,
    loadPgnGame,
    undo,
    goToMove,
    newGame,
  } = useGameContext()
  return {
    state,
    makeMove,
    annotateMove,
    setPositionFromFen,
    loadPgnGame,
    undo,
    goToMove,
    newGame,
  }
}
