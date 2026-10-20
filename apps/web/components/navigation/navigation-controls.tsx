"use client"

import { useCallback, useEffect } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react"

import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { ERROR_CLASSES, findKeyMove } from "@/lib/chess/key-moments"
import { getMoveNumbering } from "@/lib/chess/move-numbering"

export function NavigationControls() {
  const { t } = useI18n()
  const { state, goToMove, stepForward, stepBack, goToEnd } = useGame()

  // Inside a variation the arrows walk the variation; its first move steps
  // back to the main line.
  const inVariation = state.variation !== null && state.variationIndex !== null
  const atStart = !inVariation && state.currentMoveIndex === 0
  const atEnd = inVariation
    ? state.variationIndex === state.variation!.moves.length
    : state.currentMoveIndex === state.history.length

  // Game analysis runs in its own workers, so browsing does not cancel it.
  const goFirst = useCallback(() => goToMove(0), [goToMove])
  const goPrev = stepBack
  const goNext = stepForward
  const goLast = goToEnd

  // Shift + arrows: previous / next inaccuracy, mistake or blunder.
  const goToError = useCallback(
    (direction: 1 | -1) => {
      const ply = findKeyMove(
        state.history,
        getMoveNumbering(state.initialFen),
        inVariation ? state.variation!.branchIndex : state.currentMoveIndex,
        direction,
        { classes: ERROR_CLASSES }
      )
      if (ply !== null) goToMove(ply)
    },
    [state, inVariation, goToMove]
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      switch (e.key) {
        case "ArrowLeft":
          if (e.shiftKey) goToError(-1)
          else goPrev()
          break
        case "ArrowRight":
          if (e.shiftKey) goToError(1)
          else goNext()
          break
        case "Home":
          e.preventDefault()
          goFirst()
          break
        case "End":
          e.preventDefault()
          goLast()
          break
        default:
          return
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [goFirst, goPrev, goNext, goLast, goToError])

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={atStart}
        onClick={goFirst}
        aria-label={t("navigation.first")}
        title={t("navigation.first")}
      >
        <ChevronsLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={atStart}
        onClick={goPrev}
        aria-label={t("navigation.previous")}
        title={t("navigation.previous")}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={atEnd}
        onClick={goNext}
        aria-label={t("navigation.next")}
        title={t("navigation.next")}
      >
        <ChevronRight className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={atEnd}
        onClick={goLast}
        aria-label={t("navigation.last")}
        title={t("navigation.last")}
      >
        <ChevronsRight className="size-4" />
      </Button>
    </div>
  )
}
