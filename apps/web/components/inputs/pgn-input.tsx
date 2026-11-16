"use client"

import { useId, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { useEngine } from "@/hooks/use-engine"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { parsePgn } from "@/lib/chess/fen-pgn"

export function PGNInput() {
  const { t } = useI18n()
  const { loadPgnGame } = useGame()
  const { state: engineState, clearBatchAnalysis } = useEngine()
  const fieldId = useId()
  const errorId = useId()

  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [errorAttempt, setErrorAttempt] = useState(0)

  const isBatchRunning = engineState.batch.status === "running"

  function reportError(message: string) {
    setError(message)
    setErrorAttempt((attempt) => attempt + 1)
  }

  function handleLoadPgn() {
    const parsed = parsePgn(value)
    if (!parsed.ok) {
      reportError(t(parsed.error))
      return
    }

    const ok = loadPgnGame(parsed.data)
    if (!ok) {
      reportError(t("errors.gameLoadFailed"))
      return
    }

    setError(null)
    setValue(parsed.data.pgn)
    clearBatchAnalysis()
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-xs text-muted-foreground">
        {t("common.pgn")}
        <span className="sr-only">{t("inputs.pgnLabelHint")}</span>
      </label>
      <Textarea
        id={fieldId}
        placeholder={t("inputs.pastePgn")}
        className="min-h-20 font-mono"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        disabled={isBatchRunning}
      />
      {error ? (
        <p
          key={errorAttempt}
          id={errorId}
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      <Button size="sm" onClick={handleLoadPgn} disabled={isBatchRunning}>
        {t("inputs.loadPgn")}
      </Button>
    </div>
  )
}
