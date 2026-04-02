import { FENInputPlaceholder } from "@/components/inputs/fen-input"
import { PGNInputPlaceholder } from "@/components/inputs/pgn-input"
import { MoveListPlaceholder } from "@/components/analysis/move-list"
import { PVLinesPlaceholder } from "@/components/analysis/pv-lines"
import { MoveNavigatorPlaceholder } from "@/components/navigation/move-navigator"

export function AnalysisPanelPlaceholder() {
  return (
    <section className="grid gap-4">
      <MoveNavigatorPlaceholder />
      <PVLinesPlaceholder />
      <MoveListPlaceholder />
      <PGNInputPlaceholder />
      <FENInputPlaceholder />
    </section>
  )
}
