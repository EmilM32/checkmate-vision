"use client"

import { useCallback, useEffect } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react"

import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"

export function NavigationControls() {
  const { state, goToMove } = useGame()
  const { cancelBatchAnalysis } = useEngine()

  const atStart = state.currentMoveIndex === 0
  const atEnd = state.currentMoveIndex === state.history.length

  const goFirst = useCallback(() => {
    cancelBatchAnalysis()
    goToMove(0)
  }, [cancelBatchAnalysis, goToMove])
  const goPrev = useCallback(
    () => {
      cancelBatchAnalysis()
      goToMove(state.currentMoveIndex - 1)
    },
    [cancelBatchAnalysis, goToMove, state.currentMoveIndex],
  )
  const goNext = useCallback(
    () => {
      cancelBatchAnalysis()
      goToMove(state.currentMoveIndex + 1)
    },
    [cancelBatchAnalysis, goToMove, state.currentMoveIndex],
  )
  const goLast = useCallback(
    () => {
      cancelBatchAnalysis()
      goToMove(state.history.length)
    },
    [cancelBatchAnalysis, goToMove, state.history.length],
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
      >
        <ChevronsLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={atStart}
        onClick={goPrev}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={atEnd}
        onClick={goNext}
      >
        <ChevronRight className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={atEnd}
        onClick={goLast}
      >
        <ChevronsRight className="size-4" />
      </Button>
    </div>
  )
}
