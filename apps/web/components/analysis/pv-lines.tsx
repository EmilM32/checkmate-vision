import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export function PVLinesPlaceholder() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>PV Lines (Top 3)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
          1. e2e4 ...
        </div>
        <div className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
          2. d2d4 ...
        </div>
        <div className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
          3. g1f3 ...
        </div>
      </CardContent>
    </Card>
  )
}
