"use client"

import { useGameContext } from "@/context"

export function useGame() {
  const { state, makeMove, annotateMove, undo, goToMove, newGame } =
    useGameContext()
  return { state, makeMove, annotateMove, undo, goToMove, newGame }
}
