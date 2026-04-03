"use client"

import { useGameContext } from "@/context"

export function useGame() {
  const { state, makeMove, undo, goToMove, newGame } = useGameContext()
  return { state, makeMove, undo, goToMove, newGame }
}
