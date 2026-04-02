"use client"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { EvalBarPlaceholder } from "@/components/analysis/eval-bar"
import { EvalChartPlaceholder } from "@/components/analysis/eval-chart"
import { AnalysisPanelPlaceholder } from "@/components/layout/analysis-panel"
import { BoardPanelPlaceholder } from "@/components/layout/board-panel"
import { NavigationControlsPlaceholder } from "@/components/navigation/navigation-controls"
import { ToolbarPlaceholder } from "@/components/layout/toolbar"

export function MainLayoutPlaceholder() {
  return (
    <main className="cv-shell mx-auto grid w-full max-w-7xl gap-4 p-4 md:gap-6 md:p-6">
      <section className="grid gap-4 lg:grid-cols-[72px_minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
        <div className="order-1 lg:order-none">
          <EvalBarPlaceholder />
        </div>
        <div className="order-2">
          <BoardPanelPlaceholder />
        </div>
        <div className="order-4 lg:order-none">
          <div className="hidden md:block">
            <AnalysisPanelPlaceholder />
          </div>
          <div className="md:hidden">
            <Tabs defaultValue="analysis" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="analysis">Analiza</TabsTrigger>
                <TabsTrigger value="moves">Ruchy</TabsTrigger>
                <TabsTrigger value="chart">Wykres</TabsTrigger>
              </TabsList>
              <TabsContent value="analysis">
                <AnalysisPanelPlaceholder />
              </TabsContent>
              <TabsContent value="moves">
                <AnalysisPanelPlaceholder />
              </TabsContent>
              <TabsContent value="chart">
                <EvalChartPlaceholder />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      <section className="order-3 grid gap-4 lg:order-none">
        <EvalChartPlaceholder />
        <NavigationControlsPlaceholder />
        <ToolbarPlaceholder />
      </section>
    </main>
  )
}
