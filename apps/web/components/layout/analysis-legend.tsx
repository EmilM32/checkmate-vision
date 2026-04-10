"use client"

import { Cpu, Eye, EyeOff, Play } from "lucide-react"

import { useEngine } from "@/hooks/use-engine"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"

export function AnalysisLegend() {
  const { state: uiState } = useUI()
  const { state: engineState } = useEngine()
  const { t } = useI18n()

  if (!uiState.engineEnabled && !uiState.guessMode) return null
  if (uiState.showHeatmap) return null

  return (
    <div className="w-full overflow-y-auto rounded-md border border-border/70 bg-background/88 p-3 text-[11px] shadow-md">
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
