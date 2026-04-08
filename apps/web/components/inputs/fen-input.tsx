"use client"

import { useEffect, useState } from "react"
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

  useEffect(() => {
    setValue(state.fen)
  }, [state.fen])

  function handleApplyFen() {
    setError(null)

    const validation = validateFen(value)
    if (!validation.ok) {
      setError(t(validation.error))
      return
    }

    const ok = setPositionFromFen(value.trim())
    if (!ok) {
      setError(t("errors.fenSetFailed"))
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{t("common.fen")}</label>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="font-mono text-xs"
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div>
        <Button size="sm" onClick={handleApplyFen}>
          {t("inputs.setFen")}
        </Button>
      </div>
    </div>
  )
}
