import { Skeleton } from "@workspace/ui/components/skeleton"

export function ChessboardPlaceholder() {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-r-lg bg-background/60">
      <Skeleton className="size-full" />
    </div>
  )
}
