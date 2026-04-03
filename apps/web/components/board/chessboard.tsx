"use client"

import { useCallback } from "react"
import dynamic from "next/dynamic"
import type { PieceDropHandlerArgs } from "react-chessboard"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { useGame } from "@/hooks/use-game"
import { useUI } from "@/hooks/use-ui"

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  {
    ssr: false,
    loading: () => <Skeleton className="size-full" />,
  },
)

export function InteractiveChessboard() {
  const { state, makeMove } = useGame()
  const { state: uiState } = useUI()

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
          onPieceDrop: handlePieceDrop,
          animationDurationInMs: 200,
        }}
      />
    </div>
  )
}
