import { Textarea } from "@workspace/ui/components/textarea"

// TODO: Input notacji PGN
// - Wklejenie pelnej partii w formacie PGN -> parsePgn() -> GameContext.loadGame()
// - Walidacja formatu przez validatePgn() (lib/chess/pgn.ts)
// - Po zaladowaniu: moveHistory wypelnione, mozna nawigowac po ruchach
export function PGNInputPlaceholder() {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">PGN</label>
      <Textarea
        placeholder="Wklej PGN..."
        className="min-h-20 font-mono text-xs"
        readOnly
      />
    </div>
  )
}
