"use client"

import { useCallback, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import { MoveList } from "@/components/analysis/move-list"
import { EvalBar } from "@/components/analysis/eval-bar"
import { EvalChartPlaceholder } from "@/components/analysis/eval-chart"
import { PlayerBarPlaceholder } from "@/components/board/player-bar"
import { HeatmapLegend } from "@/components/board/heatmap-overlay"
import { AnalysisLegend } from "@/components/layout/analysis-legend"
import { AnalysisPanelPlaceholder } from "@/components/layout/analysis-panel"
import { BoardPanelPlaceholder } from "@/components/layout/board-panel"
import { ToolbarPlaceholder } from "@/components/layout/toolbar"
import { NavigationControls } from "@/components/navigation/navigation-controls"
import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import { exportBoardToPng } from "@/lib/export/board-export"
import { clearPersistedSession } from "@/lib/persistence/session-storage"

type MobileTab = "analysis" | "moves" | "chart"

function MobileTabContent({ activeTab }: { activeTab: MobileTab }) {
  const { t } = useI18n()

  if (activeTab === "analysis") {
    return <AnalysisPanelPlaceholder />
  }

  if (activeTab === "moves") {
    return (
      <Card className="h-full overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <CardTitle>{t("common.moves")}</CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-4rem)] p-3">
          <MoveList />
        </CardContent>
      </Card>
    )
  }

  return <EvalChartPlaceholder />
}

export function MainLayoutPlaceholder() {
  const { t } = useI18n()
  const [mobileTab, setMobileTab] = useState<MobileTab>("analysis")
  const boardExportRef = useRef<HTMLElement>(null)

  const { newGame } = useGame()
  const { resetEngine } = useEngine()
  const { state: uiState, dispatch: uiDispatch } = useUI()

  const handleExport = useCallback(async () => {
    if (!boardExportRef.current) return

    try {
      await exportBoardToPng(boardExportRef.current)
    } catch {
      // Ignore export failures in UI.
    }
  }, [])

  const handleNewAnalysis = useCallback(() => {
    newGame()
    resetEngine()
    uiDispatch({ type: "UI_RESET" })
    clearPersistedSession()
  }, [newGame, resetEngine, uiDispatch])

  const boardViewportCapClasses = uiState.showEvalChart
    ? "max-w-[min(98vw,calc(100svh-18rem))] md:max-w-[min(96vw,calc(100svh-19rem))] lg:max-w-[min(100%,calc(100svh-17rem))]"
    : "max-w-[min(98vw,calc(100svh-9rem))] md:max-w-[min(96vw,calc(100svh-10rem))] lg:max-w-[min(100%,calc(100svh-8.5rem))]"

  return (
    <main className="h-svh overflow-hidden p-2 md:p-4 lg:p-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex h-full w-full flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-center lg:gap-4"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-h-0 min-w-0 flex-1 gap-4">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="w-full pl-7">
                <PlayerBarPlaceholder color="black" />
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center">
                <div
                  className={`flex h-full max-h-full w-full items-stretch ${boardViewportCapClasses}`}
                >
                  <EvalBar />
                  <div className="min-w-0 flex-1">
                    <BoardPanelPlaceholder exportRef={boardExportRef} />
                  </div>
                </div>
              </div>

              <div className="w-full pl-7">
                <PlayerBarPlaceholder color="white" />
              </div>

              <div className="flex w-full flex-wrap items-center justify-between gap-2 px-1 py-1 lg:hidden">
                <NavigationControls />
                <ToolbarPlaceholder
                  onExport={handleExport}
                  onNewAnalysis={handleNewAnalysis}
                />
              </div>

              <AnimatePresence initial={false}>
                {uiState.showEvalChart ? (
                  <motion.div
                    key="eval-chart"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "9rem", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="w-full overflow-hidden"
                  >
                    <EvalChartPlaceholder />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="mt-2 max-h-[min(34svh,20rem)] overflow-hidden lg:hidden">
                <Tabs
                  value={mobileTab}
                  onValueChange={(value) => setMobileTab(value as MobileTab)}
                  className="flex h-full w-full flex-col"
                >
                  <TabsList className="w-full shrink-0">
                    <TabsTrigger value="analysis">
                      {t("common.analysis")}
                    </TabsTrigger>
                    <TabsTrigger value="moves">{t("common.moves")}</TabsTrigger>
                    <TabsTrigger value="chart">{t("common.chart")}</TabsTrigger>
                  </TabsList>

                  <div className="mt-3 min-h-0 flex-1 overflow-hidden">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={mobileTab}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="h-full"
                      >
                        <MobileTabContent activeTab={mobileTab} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </Tabs>
              </div>
            </div>

            <div className="hidden w-85 shrink-0 flex-col gap-3 lg:flex">
              <div className="flex-1 overflow-hidden">
                <HeatmapLegend />
                <AnalysisLegend />
              </div>
            </div>
          </div>

          <div className="hidden w-full flex-wrap items-center justify-between gap-2 px-1 py-1 lg:flex">
            <NavigationControls />
            <ToolbarPlaceholder
              onExport={handleExport}
              onNewAnalysis={handleNewAnalysis}
            />
          </div>
        </div>

        <div className="hidden w-85 shrink-0 lg:block">
          <div className="h-full overflow-y-auto pr-1">
            <AnalysisPanelPlaceholder />
          </div>
        </div>
      </motion.div>
    </main>
  )
}
