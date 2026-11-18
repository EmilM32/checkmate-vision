"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import type { EngineScore } from "@/context/engine-context"
import { useEngine } from "@/hooks/use-engine"
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion"
import { useGame } from "@/hooks/use-game"
import { useI18n } from "@/hooks/use-i18n"
import { useUI } from "@/hooks/use-ui"
import { evalToPercent, formatEval, isWhiteBetter } from "@/lib/engine/eval"

const CALC_FILL_MS = 300

const SHELL =
  "relative flex w-7 shrink-0 flex-col overflow-hidden rounded-l-lg ring-1 ring-inset ring-foreground/30"

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string

function evalCaption(
  t: Translate,
  options: {
    engineEnabled: boolean
    engineFailed: boolean
    analysisVisible: boolean
    score: EngineScore
    whiteBetter: boolean
    label: string
  }
): string {
  if (!options.engineEnabled) return t("evalBar.off")
  if (options.engineFailed) return t("evalBar.engineFailed")
  if (!options.analysisVisible) return t("evalBar.hidden")
  if (!options.score) return t("evalBar.calculating")
  if (options.score.type === "mate") {
    if (options.score.value === 0) return t("analysis.checkmate")
    const n = Math.abs(options.score.value)
    return options.whiteBetter
      ? t("evalBar.mateWhite", { n })
      : t("evalBar.mateBlack", { n })
  }
  if (options.label === "0.0") return t("evalBar.equal")
  return options.whiteBetter
    ? t("evalBar.white", { value: options.label })
    : t("evalBar.black", { value: options.label })
}

export function EvalBar() {
  const { t } = useI18n()
  const reduceMotion = usePrefersReducedMotion()
  const { state } = useEngine()
  const { state: uiState } = useUI()
  const { state: gameState } = useGame()
  const analysisVisible = !uiState.guessMode || state.guessRevealed

  const score = state.evaluation
  const engineFailed = Boolean(state.error)
  const livePct = score ? evalToPercent(score, gameState.turn) : null
  const [hold, setHold] = useState({ pct: 50, neutral: false })
  if (engineFailed && (hold.pct !== 50 || !hold.neutral)) {
    setHold({ pct: 50, neutral: true })
  } else if (
    !engineFailed &&
    livePct !== null &&
    (hold.pct !== livePct || hold.neutral)
  ) {
    setHold({ pct: livePct, neutral: false })
  }
  const pct = livePct ?? (hold.neutral ? 50 : hold.pct)
  const label = formatEval(score)

  useEffect(() => {
    if (engineFailed || livePct !== null) return
    const timer = setTimeout(() => {
      setHold((current) => ({ pct: current.pct, neutral: true }))
    }, CALC_FILL_MS)
    return () => clearTimeout(timer)
  }, [engineFailed, livePct, gameState.fen])
  const whiteBetter = isWhiteBetter(score, gameState.turn)
  const whiteOnBottom = !uiState.boardFlipped
  const evalDir = whiteOnBottom ? "0deg" : "180deg"
  // Far end of the side that is ahead, as on Lichess and Chess.com.
  const labelOnTop = whiteBetter !== whiteOnBottom
  const caption = evalCaption(t, {
    engineEnabled: uiState.engineEnabled,
    engineFailed,
    analysisVisible,
    score,
    whiteBetter,
    label,
  })

  if (!uiState.engineEnabled) {
    return (
      <div
        role="img"
        aria-label={caption}
        title={caption}
        className={`${SHELL} bg-muted`}
      />
    )
  }

  if (engineFailed) {
    return (
      <div
        role="img"
        aria-label={caption}
        title={caption}
        className={`${SHELL} bg-muted`}
      >
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs leading-none font-semibold text-muted-foreground"
        >
          !
        </span>
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!analysisVisible ? (
        <motion.div
          key="eval-hidden"
          role="img"
          aria-label={caption}
          title={caption}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`${SHELL} bg-muted`}
        >
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs leading-none font-semibold text-muted-foreground">
            ?
          </span>
        </motion.div>
      ) : (
        <motion.div
          key="eval-visible"
          role="img"
          aria-label={caption}
          title={caption}
          className={`${SHELL} eval-bar-gradient`}
          data-eval-pct={pct.toFixed(1)}
          style={{ "--eval-dir": evalDir } as React.CSSProperties}
          animate={{ "--eval-pct": `${pct}%` } as Record<string, string>}
          transition={{
            duration: reduceMotion ? 0 : 0.5,
            ease: "easeInOut",
          }}
        >
          {score ? (
            <motion.span
              data-testid="eval-label"
              key={whiteBetter ? "white" : "black"}
              initial={{ opacity: 0, y: labelOnTop ? -4 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: labelOnTop ? 4 : -4 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`absolute left-1/2 -translate-x-1/2 text-xs leading-none font-semibold tracking-tight whitespace-nowrap tabular-nums ${
                labelOnTop ? "top-1.5" : "bottom-1.5"
              } ${whiteBetter ? "text-zinc-900" : "text-zinc-100"}`}
            >
              {label}
            </motion.span>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
