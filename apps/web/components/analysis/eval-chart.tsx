import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

export function EvalChartPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Eval Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-44 w-full" />
      </CardContent>
    </Card>
  )
}
