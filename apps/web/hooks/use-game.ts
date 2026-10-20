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
    goToVariationMove,
    stepForward,
    stepBack,
    goToEnd,
    deleteVariation,
    newGame,
    restoreState,
  } = useGameContext()

  return {
    state,
    makeMove,
    annotateMove,
    setPositionFromFen,
    loadPgnGame,
    undo,
    goToMove,
    goToVariationMove,
    stepForward,
    stepBack,
    goToEnd,
    deleteVariation,
    newGame,
    restoreState,
  }
}
