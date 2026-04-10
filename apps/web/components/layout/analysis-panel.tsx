import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronUp, Cpu, Eye, EyeOff, Play } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import { FENInput } from "@/components/inputs/fen-input"
import { PGNInput } from "@/components/inputs/pgn-input"
import { MoveList } from "@/components/analysis/move-list"
import { PVLines } from "@/components/analysis/pv-lines"
import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"

export function AnalysisPanelPlaceholder() {
  const { t } = useI18n()
  const { state } = useGame()
  const {
    state: engineState,
    revealAnalysis,
    concealAnalysis,
    requestBatchAnalysis,
  } = useEngine()
  const { state: uiState, dispatch } = useUI()
  const [showImportInputs, setShowImportInputs] = useState(false)

  const isRevealAvailable = uiState.guessMode && !engineState.guessRevealed
  const batch = engineState.batch
  const canAnalyze = useMemo(
    () => state.history.length > 0 && batch.status !== "running",
    [state.history.length, batch.status],
  )

  function handleAnalyzeBatch() {
    if (state.history.length === 0) return

    const queue = [
      { moveIndex: 0, fen: state.initialFen, fenBefore: state.initialFen },
      ...state.history.map((move, index) => ({
        moveIndex: index + 1,
        fen: move.fen,
        fenBefore:
          index === 0 ? state.initialFen : state.history[index - 1]!.fen,
      })),
    ]

    requestBatchAnalysis(queue)
  }
  const progressPercent =
    batch.total > 0 ? Math.round((batch.completed / batch.total) * 100) : 0

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="space-y-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle>{t("common.analysis")}</CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={uiState.engineEnabled ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => dispatch({ type: "UI_TOGGLE_ENGINE" })}
              >
                <Cpu className="size-3.5" />
                {t("toolbar.engine")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {uiState.engineEnabled
                ? t("analysis.engineRunningTip")
                : t("analysis.engineStartTip")}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={uiState.guessMode ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  concealAnalysis()
                  dispatch({ type: "UI_TOGGLE_GUESS_MODE" })
                }}
              >
                <EyeOff className="size-3.5" />
                {t("toolbar.guess")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {uiState.guessMode
                ? t("analysis.guessOnTip")
                : t("analysis.guessOffTip")}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={engineState.guessRevealed ? "secondary" : "outline"}
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={!isRevealAvailable}
                onClick={revealAnalysis}
              >
                <Eye className="size-3.5" />
                {t("common.reveal")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("analysis.revealTip")}
            </TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-0.5 h-4" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={!canAnalyze}
                onClick={handleAnalyzeBatch}
              >
                <Play className="size-3.5" />
                {t("inputs.analyzeGame")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("inputs.firstLoadPgn")}
            </TooltipContent>
          </Tooltip>
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
