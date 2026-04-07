"use client"

import { useCallback, useMemo } from "react"
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
  },
)

const HIGHLIGHT_STYLE: React.CSSProperties = {
  background: "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
  boxShadow: "inset 0 0 1px 4px rgba(255, 170, 0, 0.6)",
}

export function InteractiveChessboard() {
  const { state, makeMove } = useGame()
  const { state: uiState } = useUI()
  const { state: engineState } = useEngine()

  const bestMoveUci =
    engineState.pvLines[0]?.pv[0] ?? engineState.bestMove ?? null

  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    if (!uiState.showArrows || !bestMoveUci || bestMoveUci.length < 4) return {}
    const from = bestMoveUci.slice(0, 2)
    const to = bestMoveUci.slice(2, 4)
    return { [from]: HIGHLIGHT_STYLE, [to]: HIGHLIGHT_STYLE }
  }, [bestMoveUci, uiState.showArrows])

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare) return false

      const isPawnPromotion =
        piece.pieceType[1] === "P" &&
        (targetSquare[1] === "8" || targetSquare[1] === "1")

      return makeMove(
        sourceSquare,
        targetSquare,
        isPawnPromotion ? "q" : undefined,
      )
    },
    [makeMove],
  )

  return (
    <div className="aspect-square w-full overflow-hidden rounded-r-lg bg-background/60">
      <Chessboard
        options={{
          position: state.fen,
          boardOrientation: uiState.boardFlipped ? "black" : "white",
          squareStyles,
          onPieceDrop: handlePieceDrop,
          animationDurationInMs: 200,
        }}
      />
    </div>
  )
}
