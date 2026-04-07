import { Badge } from "@workspace/ui/components/badge"
import { useGame } from "@/hooks/use-game"
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_LABELS,
} from "@/lib/chess/classification"

export function MoveClassificationBadgePlaceholder() {
  const { state } = useGame()
  const currentMove =
    state.currentMoveIndex > 0
      ? state.history[state.currentMoveIndex - 1]
      : null

  const classification = currentMove?.classification

  if (!classification) {
    return null
  }

  return (
    <div className="absolute right-3 bottom-3 z-30">
      <Badge
        variant="secondary"
        className="border border-white/20 text-zinc-900"
        style={{
          backgroundColor: CLASSIFICATION_COLORS[classification],
        }}
      >
        {CLASSIFICATION_LABELS[classification]}
      </Badge>
    </div>
  )
}
