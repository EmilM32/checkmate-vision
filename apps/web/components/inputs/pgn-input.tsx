"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { parsePgn } from "@/lib/chess/fen-pgn"

export function PGNInput() {
  const { t } = useI18n()
  const { loadPgnGame } = useGame()
  const {
    state: engineState,
    clearBatchAnalysis,
  } = useEngine()

  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  const isBatchRunning = engineState.batch.status === "running"

  function handleLoadPgn() {
    setError(null)
    const parsed = parsePgn(value)
    if (!parsed.ok) {
      setError(t(parsed.error))
      return
    }

    const ok = loadPgnGame(parsed.data)
    if (!ok) {
      setError(t("errors.gameLoadFailed"))
      return
    }

    setValue(parsed.data.pgn)
    clearBatchAnalysis()
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{t("common.pgn")}</label>
      <Textarea
        placeholder={t("inputs.pastePgn")}
        className="min-h-20 font-mono text-xs"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={Boolean(error)}
        disabled={isBatchRunning}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button size="sm" onClick={handleLoadPgn} disabled={isBatchRunning}>
        {t("inputs.loadPgn")}
      </Button>
    </div>
  )
}
