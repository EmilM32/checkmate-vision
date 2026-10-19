"use client"

import { defaultPieces } from "react-chessboard"

import { useI18n } from "@/hooks/use-i18n"
import { getPromotionCells, type PromotionPiece } from "@/lib/chess/promotion"

type PromotionPickerProps = {
  square: string
  color: "w" | "b"
  boardFlipped: boolean
  onSelect: (piece: PromotionPiece) => void
  onCancel: () => void
}

export function PromotionPicker({
  square,
  color,
  boardFlipped,
  onSelect,
  onCancel,
}: PromotionPickerProps) {
  const { t } = useI18n()
  const cells = getPromotionCells(square, boardFlipped)

  return (
    <div
      role="dialog"
      aria-label={t("promotion.choose")}
      className="absolute inset-0 z-20"
    >
      <button
        type="button"
        aria-label={t("promotion.cancel")}
        className="absolute inset-0 size-full cursor-default bg-black/40"
        onClick={onCancel}
      />
      {cells.map(({ piece, x, y }) => {
        const renderPiece = defaultPieces[`${color}${piece.toUpperCase()}`]

        return (
          <button
            key={piece}
            type="button"
            aria-label={t(`promotion.${piece}`)}
            title={t(`promotion.${piece}`)}
            onClick={() => onSelect(piece)}
            className="absolute cursor-pointer rounded-full bg-background/95 p-[1%] shadow-lg ring-1 ring-border transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            style={{
              left: `${x * 12.5}%`,
              top: `${y * 12.5}%`,
              width: "12.5%",
              height: "12.5%",
            }}
          >
            {renderPiece?.()}
          </button>
        )
      })}
    </div>
  )
}
