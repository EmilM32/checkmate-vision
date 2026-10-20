import type { RefObject } from "react"

import { InteractiveChessboard } from "@/components/board/chessboard"
import { ArrowOverlay } from "@/components/board/arrow-overlay"
import { MoveBadge } from "@/components/board/move-badge"
import {
  HeatmapOverlay,
  InfluenceSummary,
} from "@/components/board/heatmap-overlay"

type BoardPanelProps = {
  exportRef?: RefObject<HTMLElement | null>
}

// Kontener szachownicy z nakladkami (overlays).
// Overlaye sa renderowane absolutnie nad boardem (pointer-events: none).
export function BoardPanel({ exportRef }: BoardPanelProps) {
  return (
    <section
      ref={exportRef}
      className="[container-type:inline-size] relative w-full overflow-hidden"
    >
      <InteractiveChessboard />
      <div className="pointer-events-none absolute inset-0">
        <HeatmapOverlay />
        <ArrowOverlay />
        <InfluenceSummary />
        <MoveBadge />
      </div>
    </section>
  )
}
