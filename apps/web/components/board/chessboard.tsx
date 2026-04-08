"use client"

import { useCallback, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import type { PieceDropHandlerArgs } from "react-chessboard"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useUI } from "@/hooks/use-ui"

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  {
    ssr: false,
    loading: () => <Skeleton className="size-full" />,
  }
)

const HIGHLIGHT_STYLE: React.CSSProperties = {
  background: "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
  boxShadow: "inset 0 0 1px 4px rgba(255, 170, 0, 0.6)",
}

const INFLUENCE_TARGET_STYLE: React.CSSProperties = {
  background:
    "radial-gradient(circle at center, rgba(56, 189, 248, 0.24) 14%, rgba(56, 189, 248, 0) 72%)",
  boxShadow:
    "inset 0 0 0 4px rgba(56, 189, 248, 0.95), inset 0 0 0 7px rgba(15, 23, 42, 0.35)",
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  )
}

export function InteractiveChessboard() {
  const { state, makeMove } = useGame()
  const { state: uiState, dispatch: uiDispatch } = useUI()
  const { state: engineState } = useEngine()
  const analysisVisible = !uiState.sleuthMode || engineState.sleuthRevealed

  const bestMoveUci =
    engineState.pvLines[0]?.pv[0] ?? engineState.bestMove ?? null

  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {}

    if (
      analysisVisible &&
      uiState.showArrows &&
      bestMoveUci &&
      bestMoveUci.length >= 4
    ) {
      const from = bestMoveUci.slice(0, 2)
      const to = bestMoveUci.slice(2, 4)

      styles[from] = HIGHLIGHT_STYLE
      styles[to] = HIGHLIGHT_STYLE
    }

    if (uiState.showHeatmap && uiState.selectedInfluenceSquare) {
      styles[uiState.selectedInfluenceSquare] = {
        ...(styles[uiState.selectedInfluenceSquare] ?? {}),
        ...INFLUENCE_TARGET_STYLE,
      }
    }

    return styles
  }, [
    analysisVisible,
    bestMoveUci,
    uiState.selectedInfluenceSquare,
    uiState.showArrows,
    uiState.showHeatmap,
  ])

  const handleSquareRightClick = useCallback(
    ({ square }: { square: string }) => {
      if (!uiState.showHeatmap) return

      uiDispatch({
        type: "UI_SET_INFLUENCE_SQUARE",
        payload: uiState.selectedInfluenceSquare === square ? null : square,
      })
    },
    [uiDispatch, uiState.selectedInfluenceSquare, uiState.showHeatmap]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return

      if (event.key === "Escape" && uiState.selectedInfluenceSquare) {
        uiDispatch({ type: "UI_CLEAR_INFLUENCE_SQUARE" })
        return
      }

      if (
        event.key.toLowerCase() === "i" &&
        uiState.showHeatmap &&
        uiState.selectedInfluenceSquare
      ) {
        event.preventDefault()
        uiDispatch({ type: "UI_TOGGLE_INFLUENCE_TRACE" })
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [uiDispatch, uiState.selectedInfluenceSquare, uiState.showHeatmap])

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare) return false

      const isPawnPromotion =
        piece.pieceType[1] === "P" &&
        (targetSquare[1] === "8" || targetSquare[1] === "1")

      return makeMove(
        sourceSquare,
        targetSquare,
        isPawnPromotion ? "q" : undefined
      )
    },
    [makeMove]
  )

  return (
    <div className="aspect-square w-full overflow-hidden rounded-r-lg bg-background/60">
      <Chessboard
        options={{
          position: state.fen,
          boardOrientation: uiState.boardFlipped ? "black" : "white",
          squareStyles,
          onPieceDrop: handlePieceDrop,
          onSquareRightClick: handleSquareRightClick,
          animationDurationInMs: 200,
        }}
      />
    </div>
  )
}
