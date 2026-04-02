import { Button } from "@workspace/ui/components/button"
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react"

// TODO: Nawigacja po ruchach partii
// - |< = goToMove(0) — poczatek partii
// - <  = goToMove(current - 1) — poprzedni ruch
// - >  = goToMove(current + 1) — nastepny ruch
// - >| = goToMove(last) — koniec partii
// - Skroty klawiszowe: ArrowLeft/ArrowRight, Home/End
// - Stan z GameContext (currentMoveIndex, moveHistory.length)
export function NavigationControlsPlaceholder() {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="size-8" disabled>
        <ChevronsLeft className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-8" disabled>
        <ChevronLeft className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-8" disabled>
        <ChevronRight className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-8" disabled>
        <ChevronsRight className="size-4" />
      </Button>
    </div>
  )
}
