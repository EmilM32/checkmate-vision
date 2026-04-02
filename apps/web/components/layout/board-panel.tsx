import { ChessboardPlaceholder } from "@/components/board/chessboard"
import { ArrowOverlayPlaceholder } from "@/components/board/arrow-overlay"
import { HeatmapOverlayPlaceholder } from "@/components/board/heatmap-overlay"
import { MoveClassificationBadgePlaceholder } from "@/components/board/move-classification-badge"

export function BoardPanelPlaceholder() {
  return (
    <section className="relative">
      <ChessboardPlaceholder />
      <div className="pointer-events-none absolute inset-0">
        <HeatmapOverlayPlaceholder />
        <ArrowOverlayPlaceholder />
        <MoveClassificationBadgePlaceholder />
      </div>
    </section>
  )
}
