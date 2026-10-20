"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { PieceDropHandlerArgs } from "react-chessboard"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { PromotionPicker } from "@/components/board/promotion-picker"

import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useUI } from "@/hooks/use-ui"
import { isPromotionMove, type PromotionPiece } from "@/lib/chess/promotion"

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

const RIGHT_CLICK_HIGHLIGHT_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(255, 170, 0, 0.4)",
}

const INFLUENCE_TARGET_STYLE: React.CSSProperties = {
  background:
    "radial-gradient(circle at center, rgba(56, 189, 248, 0.24) 14%, rgba(56, 189, 248, 0) 72%)",
  boxShadow:
    "inset 0 0 0 4px rgba(56, 189, 248, 0.95), inset 0 0 0 7px rgba(15, 23, 42, 0.35)",
}

type PendingPromotion = {
  from: string
  to: string
  color: "w" | "b"
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

const COORDINATE_ON_DARK_STYLE: React.CSSProperties = {
  color: "#f6e7cf",
  fontWeight: 600,
}
const COORDINATE_ON_LIGHT_STYLE: React.CSSProperties = {
  color: "#8b5a34",
  fontWeight: 600,
}

export function InteractiveChessboard() {
  const { state, makeMove } = useGame()
  const { state: uiState, dispatch: uiDispatch } = useUI()
  const { state: engineState } = useEngine()
  const analysisVisible = !uiState.guessMode || engineState.guessRevealed

  const [rightClickSquares, setRightClickSquares] = useState<Set<string>>(
    new Set()
  )
  const altKeyRef = useRef(false)
  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null)

  const bestMoveUci =
    engineState.pvLines[0]?.pv[0] ?? engineState.bestMove ?? null

  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {}

    for (const sq of rightClickSquares) {
      styles[sq] = RIGHT_CLICK_HIGHLIGHT_STYLE
    }

    if (
      analysisVisible &&
      uiState.showArrows &&
      bestMoveUci &&
      bestMoveUci.length >= 4
    ) {
      const from = bestMoveUci.slice(0, 2)
      const to = bestMoveUci.slice(2, 4)

      styles[from] = { ...styles[from], ...HIGHLIGHT_STYLE }
      styles[to] = { ...styles[to], ...HIGHLIGHT_STYLE }
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
    rightClickSquares,
    uiState.selectedInfluenceSquare,
    uiState.showArrows,
    uiState.showHeatmap,
  ])

  const handleSquareMouseDown = useCallback(
    (
      _args: { piece: { pieceType: string } | null; square: string },
      e: React.MouseEvent
    ) => {
      if (e.button === 2) {
        altKeyRef.current = e.altKey
      }
    },
    []
  )

  const handleSquareRightClick = useCallback(
    ({ square }: { square: string }) => {
      if (uiState.showHeatmap && altKeyRef.current) {
        uiDispatch({
          type: "UI_SET_INFLUENCE_SQUARE",
          payload: uiState.selectedInfluenceSquare === square ? null : square,
        })
        return
      }

      setRightClickSquares((prev) => {
        const next = new Set(prev)
        if (next.has(square)) {
          next.delete(square)
        } else {
          next.add(square)
        }
        return next
      })
    },
    [uiDispatch, uiState.selectedInfluenceSquare, uiState.showHeatmap]
  )

  const handleSquareClick = useCallback(() => {
    if (rightClickSquares.size > 0) {
      setRightClickSquares(new Set())
    }
  }, [rightClickSquares.size])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return

      if (event.key === "Escape") {
        setPendingPromotion(null)
        if (uiState.selectedInfluenceSquare) {
          uiDispatch({ type: "UI_CLEAR_INFLUENCE_SQUARE" })
        }
        setRightClickSquares((prev) => (prev.size > 0 ? new Set() : prev))
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

  // Marks and a pending promotion belong to the position they were made in.
  const [markedFen, setMarkedFen] = useState(state.fen)
  if (markedFen !== state.fen) {
    setMarkedFen(state.fen)
    setRightClickSquares((prev) => (prev.size > 0 ? new Set() : prev))
    setPendingPromotion(null)
  }

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare, piece }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare) return false

      if (
        piece.pieceType[1] === "P" &&
        isPromotionMove(state.fen, sourceSquare, targetSquare)
      ) {
        // The pawn snaps back until a piece is chosen in the picker.
        setPendingPromotion({
          from: sourceSquare,
          to: targetSquare,
          color: piece.pieceType[0] === "b" ? "b" : "w",
        })
        return false
      }

      return makeMove(sourceSquare, targetSquare)
    },
    [makeMove, state.fen]
  )

  const handlePromotionSelect = useCallback(
    (promotion: PromotionPiece) => {
      if (!pendingPromotion) return
      makeMove(pendingPromotion.from, pendingPromotion.to, promotion)
      setPendingPromotion(null)
    },
    [makeMove, pendingPromotion]
  )

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-r-lg bg-background/60">
      <Chessboard
        options={{
          position: state.fen,
          boardOrientation: uiState.boardFlipped ? "black" : "white",
          squareStyles,
          onPieceDrop: handlePieceDrop,
          onSquareRightClick: handleSquareRightClick,
          onSquareMouseDown: handleSquareMouseDown,
          onSquareClick: handleSquareClick,
          animationDurationInMs: 200,
          // Bolder, higher-contrast coordinates than the library default,
          // so they stay legible under the heatmap tint.
          darkSquareNotationStyle: COORDINATE_ON_DARK_STYLE,
          lightSquareNotationStyle: COORDINATE_ON_LIGHT_STYLE,
        }}
      />
      {pendingPromotion ? (
        <PromotionPicker
          square={pendingPromotion.to}
          color={pendingPromotion.color}
          boardFlipped={uiState.boardFlipped}
          onSelect={handlePromotionSelect}
          onCancel={() => setPendingPromotion(null)}
        />
      ) : null}
    </div>
  )
}
