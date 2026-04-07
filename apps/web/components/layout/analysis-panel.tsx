import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { FENInputPlaceholder } from "@/components/inputs/fen-input"
import { PGNInputPlaceholder } from "@/components/inputs/pgn-input"
import { MoveList } from "@/components/analysis/move-list"
import { PVLines } from "@/components/analysis/pv-lines"

// Panel analizy — prawy sidebar na desktop, zakladki na mobile.
// Zawiera wszystkie narzedzia analizy partii w jednym Card.
export function AnalysisPanelPlaceholder() {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="border-b border-border/50">
        <CardTitle>Analysis</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-0 overflow-hidden p-0">
        {/* TODO: Top 3 linie silnika (Principal Variations)
            — dane z EngineContext.pvLines, aktualizowane w real-time przez Stockfish worker */}
        <div className="border-b border-border/50 px-4 py-3">
          <PVLines />
        </div>

        {/* TODO: Lista ruchow partii (scrollowalna)
            — klikniecie na ruch -> GameContext.goToMove(index)
            — kolorowanie ruchow wg klasyfikacji (blunder=czerwony, brilliant=cyjan, itp.) */}
        <div className="min-h-32 flex-1 overflow-hidden px-4 py-3">
          <MoveList />
        </div>

        {/* TODO: Inputy importu partii
            — PGN: wklejenie notacji partii -> parsePgn() -> GameContext.loadGame()
            — FEN: wklejenie pozycji -> validateFen() -> GameContext.setPosition() */}
        <div className="space-y-3 border-t border-border/50 px-4 py-3">
          <PGNInputPlaceholder />
          <FENInputPlaceholder />
        </div>
      </CardContent>
    </Card>
  )
}
