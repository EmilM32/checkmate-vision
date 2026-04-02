import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

export function ChessboardPlaceholder() {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader>
        <CardTitle>Chessboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative mx-auto aspect-square w-full max-w-[560px] rounded-2xl border border-border/70 bg-background/60 p-2">
          <Skeleton className="size-full rounded-xl" />
        </div>
      </CardContent>
    </Card>
  )
}
