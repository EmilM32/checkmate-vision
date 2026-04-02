import { Button } from "@workspace/ui/components/button"
import {
  FlipVertical,
  Layers,
  MoveRight,
  Search,
  Download,
} from "lucide-react"

// TODO: Przyciski narzedzi
// - Heatmap: toggle UIContext.showHeatmap — wlacza/wylacza nakladke kontroli pol
// - Arrows: toggle UIContext.showArrows — wlacza/wylacza strzalki najlepszych ruchow
// - Sleuth: toggle UIContext.sleuthMode — tryb zgadywania (ukrywa najlepszy ruch, gracz probuje sam)
// - Export: html-to-image -> zapis aktualnej pozycji jako PNG
// - Flip: toggle UIContext.boardFlipped — odwraca szachownice (bialy/czarny na dole)
const TOOLBAR_ITEMS = [
  { label: "Heatmap", icon: Layers },
  { label: "Arrows", icon: MoveRight },
  { label: "Sleuth", icon: Search },
  { label: "Export", icon: Download },
  { label: "Flip", icon: FlipVertical },
] as const

export function ToolbarPlaceholder() {
  return (
    <div className="flex items-center gap-1">
      {TOOLBAR_ITEMS.map(({ label, icon: Icon }) => (
        <Button
          key={label}
          variant="ghost"
          size="icon"
          className="size-8"
          disabled
          title={label}
        >
          <Icon className="size-4" />
        </Button>
      ))}
    </div>
  )
}
