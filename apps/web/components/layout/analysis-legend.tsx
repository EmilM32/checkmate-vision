"use client"

import { Cpu, Eye, EyeOff, MoveRight, Play } from "lucide-react"

import { useEngine } from "@/hooks/use-engine"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import { PV_LINE_COLORS, PV_LINE_LABEL_KEYS } from "@/lib/chess/pv-line-colors"

export function AnalysisLegend() {
  const { state: uiState } = useUI()
  const { state: engineState } = useEngine()
  const { t } = useI18n()

  return (
    <div className="text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">
          {t("analysisLegend.title")}
        </span>
        {uiState.guessMode && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("toolbar.guess")}
          </span>
        )}
      </div>

      <div className="mt-3 rounded-md border border-border/60 bg-muted/25 p-2 text-[10px] leading-snug text-muted-foreground">
        <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <Cpu className="size-3" />
          {t("toolbar.engine")}
        </p>
        <p className="mt-1">{t("analysisLegend.engineDesc")}</p>
      </div>

      <div className="mt-2 rounded-md border border-border/60 bg-muted/25 p-2 text-[10px] leading-snug text-muted-foreground">
        <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <MoveRight className="size-3" />
          {t("toolbar.arrows")}
        </p>
        <p className="mt-1">{t("analysisLegend.arrowsDesc")}</p>
        <ul className="mt-1.5 space-y-1">
          {([1, 2, 3] as const).map((id) => (
            <li key={id} className="flex items-center gap-2">
              <span
                className="h-1 w-5 shrink-0 rounded-full"
                style={{ backgroundColor: PV_LINE_COLORS[id] }}
              />
              {t(PV_LINE_LABEL_KEYS[id])}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2 rounded-md border border-border/60 bg-muted/25 p-2 text-[10px] leading-snug text-muted-foreground">
        <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <EyeOff className="size-3" />
          {t("toolbar.guess")}
        </p>
        <p className="mt-1">{t("analysisLegend.guessDesc")}</p>
      </div>

      <div className="mt-2 rounded-md border border-border/60 bg-muted/25 p-2 text-[10px] leading-snug text-muted-foreground">
        <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <Eye className="size-3" />
          {t("common.reveal")}
        </p>
        <p className="mt-1">{t("analysisLegend.revealDesc")}</p>
      </div>

      <div className="mt-2 rounded-md border border-border/60 bg-muted/25 p-2 text-[10px] leading-snug text-muted-foreground">
        <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <Play className="size-3" />
          {t("inputs.analyzeGame")}
        </p>
        <p className="mt-1">{t("analysisLegend.analyzeGameDesc")}</p>
      </div>

      {(uiState.engineEnabled || uiState.guessMode) && (
        <div className="mt-3 flex flex-col gap-1.5 text-[10px] text-muted-foreground">
          {uiState.engineEnabled && (
            <span className="inline-flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-emerald-600/80" />
              <span>{t("analysisLegend.engineActive")}</span>
            </span>
          )}
          {uiState.guessMode && (
            <span className="inline-flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-amber-500/80" />
              <span>
                {engineState.guessRevealed
                  ? t("analysisLegend.guessRevealed")
                  : t("analysisLegend.guessHidden")}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
