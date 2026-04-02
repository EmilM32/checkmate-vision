// TODO: Principal Variations — top 3 linie analizy silnika
// - Dane z EngineContext.pvLines (tablica {moves: string[], score: number}[])
// - Kazda linia pokazuje: score (np. +1.2) + ciag ruchow w notacji algebraicznej
// - Klikniecie na linie -> podswietlenie ruchow na szachownicy (strzalki)
// - Aktualizacja w real-time z Stockfish web worker (useEngineWorker hook)
export function PVLinesPlaceholder() {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">Engine Lines</p>
      {["1. e2e4 ...", "2. d2d4 ...", "3. g1f3 ..."].map((line) => (
        <div
          key={line}
          className="rounded-md bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground"
        >
          {line}
        </div>
      ))}
    </div>
  )
}
