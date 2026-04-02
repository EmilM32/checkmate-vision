import { Input } from "@workspace/ui/components/input"

// TODO: Input pozycji FEN
// - Wyswietla aktualny FEN z GameContext.fen
// - Edytowalny: wklejenie nowego FEN -> validateFen() -> GameContext.setPosition()
// - Przycisk kopiowania aktualnego FEN do schowka
export function FENInputPlaceholder() {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">FEN</label>
      <Input value="startpos" readOnly className="font-mono text-xs" />
    </div>
  )
}
