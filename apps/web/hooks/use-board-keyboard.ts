"use client"

import { useEffect, useRef } from "react"

import { useGame } from "@/hooks/use-game"
import { ERROR_CLASSES, findKeyMove } from "@/lib/chess/key-moments"
import { getMoveNumbering } from "@/lib/chess/move-numbering"

const STEP_MS = 100

function typingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (target instanceof HTMLElement && target.isContentEditable) return true
  return Boolean(
    target.closest("[role=dialog], [role=alertdialog], dialog[open]")
  )
}

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
    if (timer.current !== 0) return
    const next = pending.current
    if (!next) return
    const shown = next.variation
      ? game.state.variationIndex
      : game.state.currentMoveIndex
    if (shown === next.index) pending.current = null
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
      const { state } = gameRef.current
      const base = pending.current ?? live()
      // Same bounds as goToMove / goToVariationMove: the main line is
      // [0, history.length], a variation is [0, variation.moves.length].
      const max = base.variation
        ? (state.variation?.moves.length ?? 0)
        : state.history.length
      const index = Math.max(0, Math.min(base.index + direction, max))
      if (index === base.index) return
      pending.current = { index, variation: base.variation }
      const now = performance.now()
      if (timer.current !== 0) return
      const current = live()
      const oneStep =
        pending.current.variation === current.variation &&
        pending.current.index === current.index + direction
      if (now - lastAt.current >= STEP_MS && oneStep) {
        lastAt.current = now
        if (direction === 1) gameRef.current.stepForward()
        else gameRef.current.stepBack()
        return
      }
      if (now - lastAt.current >= STEP_MS) {
        flush()
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
      if (event.defaultPrevented || typingTarget(event.target)) return
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
