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
import { EvalChart } from "@/components/analysis/eval-chart"
import { PlayerBar } from "@/components/board/player-bar"
import { AnalysisPanel } from "@/components/layout/analysis-panel"
import { BoardPanel } from "@/components/layout/board-panel"
import { Toolbar } from "@/components/layout/toolbar"
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
    return <AnalysisPanel />
  }

  if (activeTab === "moves") {
    return (
      <Card className="h-[min(60svh,28rem)] overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <CardTitle>{t("common.moves")}</CardTitle>
        </CardHeader>
        <CardContent className="h-[calc(100%-4rem)] p-3">
          <MoveList />
        </CardContent>
      </Card>
    )
  }

  return <EvalChart />
}

export function MainLayout() {
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

  const topPlayerColor = uiState.boardFlipped ? "white" : "black"
  const bottomPlayerColor = uiState.boardFlipped ? "black" : "white"

  return (
    <main className="min-h-svh p-2 md:p-4 lg:h-svh lg:overflow-hidden lg:p-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex w-full flex-col gap-3 lg:h-full lg:flex-row lg:items-stretch lg:justify-center lg:gap-4"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-h-0 min-w-0 flex-1 gap-4">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {/* Size container: the board group takes the largest square
                  that fits next to the eval bar (w-7) and between the two
                  player bars (h-9 each), whatever the rest of the layout.
                  Below lg the page scrolls instead: the board follows the
                  width, capped so it stays within the viewport height
                  together with the bars and the controls under it. */}
              <div className="[container-type:inline-size] flex justify-center lg:[container-type:size] lg:min-h-0 lg:flex-1 lg:items-center">
                <div className="flex w-[min(100cqw,calc(100svh-9rem+1.75rem))] flex-col lg:w-[min(100cqw,calc(100cqh-4.5rem+1.75rem))]">
                  <div className="pl-7">
                    <PlayerBar color={topPlayerColor} />
                  </div>
                  <div className="flex items-stretch">
                    <EvalBar />
                    <div className="min-w-0 flex-1">
                      <BoardPanel exportRef={boardExportRef} />
                    </div>
                  </div>
                  <div className="pl-7">
                    <PlayerBar color={bottomPlayerColor} />
                  </div>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center justify-between gap-2 px-1 py-1 lg:hidden">
                <NavigationControls />
                <Toolbar
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
                    <EvalChart />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="mt-2 lg:hidden">
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

                  <div className="mt-3">
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
          </div>

          <div className="hidden w-full flex-wrap items-center justify-between gap-2 px-1 py-1 lg:flex">
            <NavigationControls />
            <Toolbar
              onExport={handleExport}
              onNewAnalysis={handleNewAnalysis}
            />
          </div>
        </div>

        <div className="hidden w-85 shrink-0 lg:block">
          <div className="h-full overflow-y-auto pr-1">
            <AnalysisPanel />
          </div>
        </div>
      </motion.div>
    </main>
  )
}
