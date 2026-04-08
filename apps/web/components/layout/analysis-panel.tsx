import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { FENInput } from "@/components/inputs/fen-input"
import { PGNInput } from "@/components/inputs/pgn-input"
import { MoveList } from "@/components/analysis/move-list"
import { PVLines } from "@/components/analysis/pv-lines"
import { useEngine } from "@/hooks/use-engine"
import { useI18n } from "@/hooks/use-i18n"

// Panel analizy — prawy sidebar na desktop, zakladki na mobile.
// Zawiera wszystkie narzedzia analizy partii w jednym Card.
export function AnalysisPanelPlaceholder() {
  const { t } = useI18n()
  const { state: engineState } = useEngine()
  const batch = engineState.batch
  const progressPercent =
    batch.total > 0 ? Math.round((batch.completed / batch.total) * 100) : 0

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="border-b border-border/50">
        <CardTitle>{t("common.analysis")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-0 overflow-hidden p-0">
        {/* TODO: Top 3 linie silnika (Principal Variations)
            — dane z EngineContext.pvLines, aktualizowane w real-time przez Stockfish worker */}
        <div className="border-b border-border/50 px-4 py-3">
          <PVLines />
        </div>

        <div className="border-b border-border/50 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {batch.status === "running"
                ? t("analysis.batchRunning", {
                    completed: batch.completed,
                    total: batch.total,
                  })
                : batch.status === "done"
                  ? t("analysis.batchDone")
                  : batch.status === "cancelled"
                    ? t("analysis.batchCancelled")
                    : batch.status === "error"
                      ? t("analysis.batchError")
                      : t("analysis.batchIdle")}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-200 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {batch.lastError ? (
            <p className="mt-1 text-xs text-destructive">{batch.lastError}</p>
          ) : null}
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
          <PGNInput />
          <FENInput />
        </div>
      </CardContent>
    </Card>
  )
}
