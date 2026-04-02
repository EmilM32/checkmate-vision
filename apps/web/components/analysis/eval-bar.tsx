// TODO: Pasek ewaluacji pozycji
// - Dynamiczny gradient bialy/czarny — proporcja sterowana przez EngineContext.evaluation (cp/mate)
// - Wyswietlanie wartosci liczbowej ewaluacji (+1.2, -0.5, M3)
// - Animacja zmiany przy kazdym ruchu (framer-motion)
// - CSS var --eval-pct ustawiany dynamicznie (0% = czarny wygrywa, 100% = bialy)
export function EvalBarPlaceholder() {
  return (
    <div className="eval-bar-gradient flex w-7 shrink-0 flex-col overflow-hidden rounded-l-lg" />
  )
}
