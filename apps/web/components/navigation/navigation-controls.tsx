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

export function NavigationControls() {
  const { t } = useI18n()
  const { state, goToMove } = useGame()

  const atStart = state.currentMoveIndex === 0
  const atEnd = state.currentMoveIndex === state.history.length

  // Game analysis runs in its own workers, so browsing does not cancel it.
  const goFirst = useCallback(() => goToMove(0), [goToMove])
  const goPrev = useCallback(
    () => goToMove(state.currentMoveIndex - 1),
    [goToMove, state.currentMoveIndex]
  )
  const goNext = useCallback(
    () => goToMove(state.currentMoveIndex + 1),
    [goToMove, state.currentMoveIndex]
  )
  const goLast = useCallback(
    () => goToMove(state.history.length),
    [goToMove, state.history.length]
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return

      switch (e.key) {
        case "ArrowLeft":
          goPrev()
          break
        case "ArrowRight":
          goNext()
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
  }, [goFirst, goPrev, goNext, goLast])

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
