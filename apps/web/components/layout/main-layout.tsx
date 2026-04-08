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
      <Card className="h-90 overflow-hidden">
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
  const { dispatch: uiDispatch } = useUI()

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

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-3 md:p-5 lg:p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex w-full max-w-350 flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-6"
      >
        <div className="flex w-full max-w-[96vw] flex-col items-center lg:max-w-none">
          <div className="w-full pl-7">
            <PlayerBarPlaceholder color="black" />
          </div>

          <div className="flex w-[min(94vw,calc(100svh-20rem))] items-stretch md:w-[min(88vw,calc(100svh-19rem))] lg:w-[min(58vw,calc(100svh-15rem))] lg:max-w-180">
            <EvalBar />
            <BoardPanelPlaceholder exportRef={boardExportRef} />
          </div>

          <div className="w-full pl-7">
            <PlayerBarPlaceholder color="white" />
          </div>

          <div className="flex w-full flex-col items-start justify-between gap-2 px-1 py-1 md:flex-row md:items-center">
            <NavigationControls />
            <ToolbarPlaceholder
              onExport={handleExport}
              onNewAnalysis={handleNewAnalysis}
            />
          </div>

          <div className="w-full">
            <EvalChartPlaceholder />
          </div>
        </div>

        <div className="hidden w-85 shrink-0 self-stretch lg:block">
          <AnalysisPanelPlaceholder />
        </div>
      </motion.div>

      <div className="mt-4 w-full max-w-[94vw] lg:hidden">
        <Tabs
          value={mobileTab}
          onValueChange={(value) => setMobileTab(value as MobileTab)}
          className="w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger value="analysis">{t("common.analysis")}</TabsTrigger>
            <TabsTrigger value="moves">{t("common.moves")}</TabsTrigger>
            <TabsTrigger value="chart">{t("common.chart")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mobileTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mt-3"
          >
            <MobileTabContent activeTab={mobileTab} />
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  )
}
