"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { EvalChart } from "@/components/analysis/eval-chart"
import { MoveList } from "@/components/analysis/move-list"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"

/**
 * The game's history beside the board on wide screens: the evaluation chart
 * (when switched on) above the full-height move list, so the chart takes no
 * height from the board.
 */
export function GamePanel() {
  const { t } = useI18n()
  const { state: uiState } = useUI()

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
      <CardHeader className="border-b border-border/50 py-4">
        <CardTitle>{t("common.game")}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <AnimatePresence initial={false}>
          {uiState.showEvalChart ? (
            <motion.div
              key="eval-chart"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "9rem", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="shrink-0 overflow-hidden"
            >
              <EvalChart />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="min-h-0 flex-1">
          <MoveList />
        </div>
      </CardContent>
    </Card>
  )
}
