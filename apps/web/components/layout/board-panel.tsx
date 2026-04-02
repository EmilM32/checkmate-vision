import { ChessboardPlaceholder } from "@/components/board/chessboard"
import { ArrowOverlayPlaceholder } from "@/components/board/arrow-overlay"
import { HeatmapOverlayPlaceholder } from "@/components/board/heatmap-overlay"
import { MoveClassificationBadgePlaceholder } from "@/components/board/move-classification-badge"

// Kontener szachownicy z nakladkami (overlays).
// Overlaye sa renderowane absolutnie nad boardem (pointer-events: none).
export function BoardPanelPlaceholder() {
  return (
    <section className="relative overflow-hidden">
      <ChessboardPlaceholder />
      <div className="pointer-events-none absolute inset-0">
        {/* TODO: Heatmapa kontroli pol — kolorowanie pol wg buildHeatmap() (lib/chess/heatmap.ts) */}
        <HeatmapOverlayPlaceholder />
        {/* TODO: Strzalki najlepszych ruchow silnika — rysowane na Canvas/SVG z danych EngineContext.bestMove/pvLines */}
        <ArrowOverlayPlaceholder />
        {/* TODO: Badge klasyfikacji ruchu (brilliant/great/best/good/inaccuracy/mistake/blunder)
            — wyswietlany po kazdym ruchu, dane z classifyMove() (lib/chess/classification.ts) */}
        <MoveClassificationBadgePlaceholder />
      </div>
    </section>
  )
}
