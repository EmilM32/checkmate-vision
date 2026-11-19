"use client"

import { useEffect, useRef } from "react"

import { useGame } from "@/hooks/use-game"
import { ERROR_CLASSES, findKeyMove } from "@/lib/chess/key-moments"
import { getMoveNumbering } from "@/lib/chess/move-numbering"

const STEP_MS = 100

// One listener for the page. The first arrow applies at once. Later arrows
// only remember the latest index, and one timer publishes it at most every
// 100 ms and once more when the repeat ends.
export function useBoardKeyboard() {
  const game = useGame()
  const gameRef = useRef(game)

  const pending = useRef<{ index: number; variation: boolean } | null>(null)
  const timer = useRef(0)
  const lastAt = useRef(Number.NEGATIVE_INFINITY)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    if (timer.current === 0) pending.current = null
  }, [game.state.currentMoveIndex, game.state.variationIndex])

  useEffect(() => {
    const live = () => {
      const { state } = gameRef.current
      const variation = state.variation !== null && state.variationIndex !== null
      return {
        index: variation ? state.variationIndex! : state.currentMoveIndex,
        variation,
      }
    }

    const flush = () => {
      timer.current = 0
      lastAt.current = performance.now()
      const next = pending.current
      pending.current = null
      if (!next) return
      if (next.variation) gameRef.current.goToVariationMove(next.index)
      else gameRef.current.goToMove(next.index)
    }

    const step = (direction: 1 | -1) => {
      const base = pending.current ?? live()
      pending.current = {
        index: base.index + direction,
        variation: base.variation,
      }
      const now = performance.now()
      if (timer.current !== 0) return
      if (now - lastAt.current >= STEP_MS) {
        lastAt.current = now
        if (direction === 1) gameRef.current.stepForward()
        else gameRef.current.stepBack()
        return
      }
      timer.current = window.setTimeout(
        flush,
        Math.max(0, STEP_MS - (now - lastAt.current))
      )
    }

    const stopRepeat = () => {
      if (timer.current !== 0) window.clearTimeout(timer.current)
      timer.current = 0
      pending.current = null
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      const { state, goToMove, goToEnd } = gameRef.current

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const direction = event.key === "ArrowRight" ? 1 : -1
        if (event.shiftKey) {
          stopRepeat()
          const inVariation =
            state.variation !== null && state.variationIndex !== null
          const ply = findKeyMove(
            state.history,
            getMoveNumbering(state.initialFen),
            inVariation ? state.variation!.branchIndex : state.currentMoveIndex,
            direction,
            { classes: ERROR_CLASSES }
          )
          if (ply !== null) goToMove(ply)
          return
        }
        step(direction)
        return
      }

      if (event.key === "Home") {
        event.preventDefault()
        stopRepeat()
        goToMove(0)
        return
      }
      if (event.key === "End") {
        event.preventDefault()
        stopRepeat()
        goToEnd()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      if (timer.current !== 0) window.clearTimeout(timer.current)
      timer.current = 0
      pending.current = null
    }
  }, [])
}
