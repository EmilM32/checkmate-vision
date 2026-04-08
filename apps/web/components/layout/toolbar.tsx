"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Download,
  Eye,
  FlipVertical,
  Layers,
  MoveRight,
  RotateCcw,
  Search,
} from "lucide-react"

import { useEngine } from "@/hooks/use-engine"
import { useUI } from "@/hooks/use-ui"

type ToolbarPlaceholderProps = {
  onExport: () => void
  onNewAnalysis: () => void
}

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

export function ToolbarPlaceholder({
  onExport,
  onNewAnalysis,
}: ToolbarPlaceholderProps) {
  const { state: uiState, dispatch } = useUI()
  const { state: engineState, revealAnalysis, concealAnalysis } = useEngine()

  const isRevealAvailable = uiState.sleuthMode && !engineState.sleuthRevealed

  return (
    <div className="flex items-center gap-1.5">
      {TOOLBAR_ITEMS.map(({ label, icon: Icon }) => (
        <Button
          key={label}
          variant={
            label === "Heatmap" && uiState.showHeatmap
              ? "secondary"
              : label === "Arrows" && uiState.showArrows
                ? "secondary"
                : label === "Sleuth" && uiState.sleuthMode
                  ? "secondary"
                  : label === "Flip" && uiState.boardFlipped
                    ? "secondary"
                    : "ghost"
          }
          size="icon"
          className="size-8"
          title={label}
          onClick={() => {
            if (label === "Heatmap") {
              dispatch({ type: "UI_TOGGLE_HEATMAP" })
              return
            }

            if (label === "Arrows") {
              dispatch({ type: "UI_TOGGLE_ARROWS" })
              return
            }

            if (label === "Sleuth") {
              concealAnalysis()
              dispatch({ type: "UI_TOGGLE_SLEUTH_MODE" })
              return
            }

            if (label === "Export") {
              onExport()
              return
            }

            if (label === "Flip") {
              dispatch({ type: "UI_TOGGLE_BOARD_FLIPPED" })
            }
          }}
        >
          <Icon className="size-4" />
        </Button>
      ))}

      <Button
        variant={engineState.sleuthRevealed ? "secondary" : "outline"}
        size="sm"
        className="h-8"
        disabled={!isRevealAvailable}
        onClick={revealAnalysis}
      >
        <Eye className="mr-1 size-4" />
        Reveal
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={onNewAnalysis}
      >
        <RotateCcw className="mr-1 size-4" />
        New
      </Button>
    </div>
  )
}
