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
import { PlayerBarPlaceholder } from "@/components/board/player-bar"

export function MainLayoutPlaceholder() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-3 md:p-6">
      <div className="flex w-full max-w-350 items-start justify-center gap-6">
        {/* ── Board Column ── */}
        <div className="flex flex-col items-center">
          {/* TODO: Pasek gracza (czarny) — avatar, nick/rating, zegar
              Implementacja: komponent PlayerBar z danymi z GameContext */}
          <div className="w-full pl-7">
            <PlayerBarPlaceholder color="black" />
          </div>

          {/* TODO: Eval bar + interaktywna szachownica
              - EvalBar: dynamiczny gradient bialy/czarny sterowany przez EngineContext (cp/mate)
              - Board: react-chessboard z chess.js, ruchy drag&drop, podswietlanie pol */}
          <div className="flex w-[min(92vw,calc(100svh-20rem))] items-stretch lg:w-[min(56vw,calc(100svh-16rem))] lg:max-w-170">
            <EvalBarPlaceholder />
            <BoardPanelPlaceholder />
          </div>

          {/* TODO: Pasek gracza (bialy) — avatar, nick/rating, zegar */}
          <div className="w-full pl-7">
            <PlayerBarPlaceholder color="white" />
          </div>

          {/* TODO: Nawigacja po ruchach (|< < > >|) + Toolbar (heatmap, strzalki, sleuth, export, flip)
              - Nawigacja: prev/next z GameContext (currentMoveIndex)
              - Flip: odwracanie boardu przez UIContext
              - Heatmap/Arrows: toggle widocznosci overlayow przez UIContext
              - Sleuth: tryb zgadywania najlepszego ruchu
              - Export: zapis pozycji/partii jako PNG (html-to-image) */}
          <div className="flex w-full items-center justify-between px-1 py-1">
            <NavigationControlsPlaceholder />
            <ToolbarPlaceholder />
          </div>

          {/* TODO: Wykres ewaluacji w czasie partii (recharts)
              - Os X: numery ruchow, Os Y: ewaluacja w centypionkach
              - Klikniecie na punkt -> przejscie do danego ruchu */}
          <div className="w-full">
            <EvalChartPlaceholder />
          </div>
        </div>

        {/* ── Panel analizy (desktop) ── */}
        {/* TODO: Pelny panel analizy widoczny na duzych ekranach (lg+)
            Zawartosc: PV lines, lista ruchow, input PGN/FEN — patrz AnalysisPanel */}
        <div className="hidden w-85 shrink-0 self-stretch lg:block">
          <AnalysisPanelPlaceholder />
        </div>
      </div>

      {/* ── Panel analizy (mobile) ── */}
      {/* TODO: Na mobile analiza jest w zakladkach pod szachownica */}
      <div className="mt-4 w-full max-w-[92vw] lg:hidden">
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
    </main>
  )
}
