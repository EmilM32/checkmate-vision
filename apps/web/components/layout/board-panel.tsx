import type { RefObject } from "react"

import { InteractiveChessboard } from "@/components/board/chessboard"
import { ArrowOverlay } from "@/components/board/arrow-overlay"
import { HeatmapOverlay } from "@/components/board/heatmap-overlay"

type BoardPanelPlaceholderProps = {
  exportRef?: RefObject<HTMLElement | null>
}

// Kontener szachownicy z nakladkami (overlays).
// Overlaye sa renderowane absolutnie nad boardem (pointer-events: none).
export function BoardPanelPlaceholder({
  exportRef,
}: BoardPanelPlaceholderProps) {
  return (
    <section ref={exportRef} className="relative w-full overflow-hidden">
      <InteractiveChessboard />
      <div className="pointer-events-none absolute inset-0">
        <HeatmapOverlay />
        <ArrowOverlay />
      </div>
    </section>
  )
}
