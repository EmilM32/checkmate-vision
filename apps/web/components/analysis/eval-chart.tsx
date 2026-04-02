import { Skeleton } from "@workspace/ui/components/skeleton"

// TODO: Wykres ewaluacji partii (recharts — AreaChart)
// - Os X: numer ruchu (1, 2, 3...), Os Y: ewaluacja w centypionkach
// - Linia podzialu na 0 (rowna pozycja)
// - Kolorowanie: zielone powyzej 0 (bialy lepiej), czerwone ponizej (czarny lepiej)
// - Klikniecie na punkt wykresu -> GameContext.goToMove(index)
// - Dane: tablica ewaluacji per ruch przechowywana w EngineContext
export function EvalChartPlaceholder() {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-border/50">
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
