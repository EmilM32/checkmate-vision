import { ScrollArea } from "@workspace/ui/components/scroll-area"

// TODO: Lista ruchow partii
// - Format: numer ruchu + ruch bialego + ruch czarnego (np. "1. e4 e5")
// - Aktualny ruch podswietlony (GameContext.currentMoveIndex)
// - Klikniecie na ruch -> GameContext.goToMove(index)
// - Kolorowanie wg klasyfikacji: brilliant(cyjan), great(niebieski), best(zielony),
//   good(jasno-zielony), inaccuracy(zolty), mistake(pomaranczowy), blunder(czerwony)
// - Auto-scroll do aktualnego ruchu
export function MoveListPlaceholder() {
  return (
    <ScrollArea className="h-full">
      <ol className="grid gap-1 font-mono text-xs text-muted-foreground">
        <li>1. e4 e5</li>
        <li>2. Nf3 Nc6</li>
        <li>3. Bb5 a6</li>
        <li>4. Ba4 Nf6</li>
        <li>5. O-O Be7</li>
      </ol>
    </ScrollArea>
  )
}
