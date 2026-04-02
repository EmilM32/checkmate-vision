// TODO: Pasek informacji o graczu
// - Avatar (zdjecie/inicjaly), nick, rating (ELO)
// - Zegar szachowy (odliczanie czasu, formatowanie mm:ss)
// - Zbite figury przeciwnika (material advantage)
// - Dane z GameContext (players, clocks)
export function PlayerBarPlaceholder({
  color,
}: {
  color: "white" | "black"
}) {
  return (
    <div className="flex w-full items-center justify-between px-1 py-1.5">
      <div className="flex items-center gap-2">
        <div className="size-6 rounded-full bg-muted" />
        <span className="text-sm font-medium text-foreground">
          {color === "white" ? "White" : "Black"}
        </span>
      </div>
      <span className="font-mono text-sm text-muted-foreground">10:00</span>
    </div>
  )
}
