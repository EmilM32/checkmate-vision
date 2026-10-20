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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import { FENInput } from "@/components/inputs/fen-input"
import { PGNInput } from "@/components/inputs/pgn-input"
import { GameSummary } from "@/components/analysis/game-summary"
import { MoveList } from "@/components/analysis/move-list"
import { PVLines } from "@/components/analysis/pv-lines"
import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { Preferences } from "@/components/layout/preferences"
import { useUI } from "@/hooks/use-ui"

export function AnalysisPanel() {
  const { t } = useI18n()
  const { state } = useGame()
  const {
    state: engineState,
    revealAnalysis,
    concealAnalysis,
    requestBatchAnalysis,
  } = useEngine()
  const { state: uiState, dispatch } = useUI()
  // Until the user toggles it, the import section is open while there is
  // nothing to analyse, so loading a game is the obvious first step.
  const [importToggled, setImportToggled] = useState<boolean | null>(null)
  const showImportInputs = importToggled ?? state.history.length === 0

  const isRevealAvailable = uiState.guessMode && !engineState.guessRevealed
  const batch = engineState.batch
  const canAnalyze = useMemo(
    () => state.history.length > 0 && batch.status !== "running",
    [state.history.length, batch.status]
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
      <CardHeader className="space-y-2 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t("common.analysis")}</CardTitle>
          <Preferences />
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 basis-full gap-1.5 text-xs"
                disabled={!canAnalyze}
                onClick={handleAnalyzeBatch}
              >
                <Play className="size-3.5" />
                {t("inputs.analyzeGame")}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {state.history.length > 0
                ? t("analysisLegend.analyzeGameDesc")
                : t("inputs.firstLoadPgn")}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0">
        <div className="border-b border-border/50 px-4 py-3">
          <PVLines />
        </div>

        {/* Game analysis progress (hidden until one is started) and the
            summary of a fully analysed game. */}
        <div className="space-y-2 border-b border-border/50 px-4 py-2 empty:hidden">
          {batch.status !== "idle" ? (
            <div>
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
                        : t("analysis.batchError")}
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
                <p className="mt-1 text-xs text-destructive">
                  {t(batch.lastError)}
                </p>
              ) : null}
            </div>
          ) : null}
          <GameSummary />
        </div>
        {/* From xl the move list lives in the game panel left of the board. */}
        <div className="h-48 overflow-hidden px-4 py-3 lg:h-auto lg:min-h-32 lg:flex-1 xl:hidden">
          <MoveList />
        </div>

        {/* Collapsible import inputs (PGN / FEN) */}
        <div className="border-t border-border/50">
          <button
            type="button"
            onClick={() => setImportToggled(!showImportInputs)}
            aria-expanded={showImportInputs}
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
