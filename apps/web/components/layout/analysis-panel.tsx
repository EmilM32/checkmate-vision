import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronUp, Cpu, Eye, Search } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
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
import { useUI } from "@/hooks/use-ui"

export function AnalysisPanelPlaceholder() {
  const { t } = useI18n()
  const { state: engineState, revealAnalysis, concealAnalysis } = useEngine()
  const { state: uiState, dispatch } = useUI()
  const [showImportInputs, setShowImportInputs] = useState(false)

  const isRevealAvailable = uiState.sleuthMode && !engineState.sleuthRevealed
  const batch = engineState.batch
  const progressPercent =
    batch.total > 0 ? Math.round((batch.completed / batch.total) * 100) : 0

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle>{t("common.analysis")}</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant={uiState.engineEnabled ? "secondary" : "ghost"}
              size="icon"
              className="size-7"
              title={
                uiState.engineEnabled
                  ? t("analysis.engineRunningTip")
                  : t("analysis.engineStartTip")
              }
              onClick={() => dispatch({ type: "UI_TOGGLE_ENGINE" })}
            >
              <Cpu className="size-3.5" />
            </Button>
            <Button
              variant={uiState.sleuthMode ? "secondary" : "ghost"}
              size="icon"
              className="size-7"
              title={
                uiState.sleuthMode
                  ? t("analysis.sleuthOnTip")
                  : t("analysis.sleuthOffTip")
              }
              onClick={() => {
                concealAnalysis()
                dispatch({ type: "UI_TOGGLE_SLEUTH_MODE" })
              }}
            >
              <Search className="size-3.5" />
            </Button>
            <Button
              variant={engineState.sleuthRevealed ? "secondary" : "outline"}
              size="sm"
              className="h-7 text-xs"
              disabled={!isRevealAvailable}
              title={t("analysis.revealTip")}
              onClick={revealAnalysis}
            >
              <Eye className="mr-1 size-3.5" />
              {t("common.reveal")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0">
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

        {/* Collapsible import inputs (PGN / FEN) */}
        <div className="border-t border-border/50">
          <button
            type="button"
            onClick={() => setShowImportInputs((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>{t("inputs.importGame")}</span>
            {showImportInputs ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronUp className="size-3.5" />
            )}
          </button>
          <AnimatePresence initial={false}>
            {showImportInputs ? (
              <motion.div
                key="import-inputs"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-3 px-4 pb-3">
                  <PGNInput />
                  <FENInput />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}
