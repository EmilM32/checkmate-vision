"use client"

import { useId, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { validateFen } from "@/lib/chess/fen-pgn"

export function FENInput() {
  const { t } = useI18n()
  const { state, setPositionFromFen } = useGame()
  const [value, setValue] = useState(state.fen)
  const [error, setError] = useState<string | null>(null)
  const [errorAttempt, setErrorAttempt] = useState(0)
  const fieldId = useId()
  const errorId = useId()

  // Follow the board, but keep what the user typed until the position changes.
  const [syncedFen, setSyncedFen] = useState(state.fen)
  if (syncedFen !== state.fen) {
    setSyncedFen(state.fen)
    setValue(state.fen)
  }

  function reportError(message: string) {
    setError(message)
    setErrorAttempt((attempt) => attempt + 1)
  }

  function handleApplyFen() {
    const validation = validateFen(value)
    if (!validation.ok) {
      reportError(t(validation.error))
      return
    }

    const ok = setPositionFromFen(value.trim())
    if (!ok) {
      reportError(t("errors.fenSetFailed"))
      return
    }

    setError(null)
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className="text-xs text-muted-foreground">
        {t("common.fen")}
        <span className="sr-only">{t("inputs.fenLabelHint")}</span>
      </label>
      <Input
        id={fieldId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="font-mono"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
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
      <div>
        <Button size="sm" onClick={handleApplyFen}>
          {t("inputs.setFen")}
        </Button>
      </div>
    </div>
  )
}
