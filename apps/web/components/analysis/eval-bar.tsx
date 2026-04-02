import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export function EvalBarPlaceholder() {
  return (
    <Card size="sm" className="h-full min-h-24">
      <CardHeader>
        <CardTitle>Eval Bar</CardTitle>
      </CardHeader>
      <CardContent className="h-full">
        <div className="h-full min-h-16 rounded-xl border border-border/70 bg-gradient-to-b from-emerald-400/50 via-emerald-500/25 to-slate-900/70" />
      </CardContent>
    </Card>
  )
}
