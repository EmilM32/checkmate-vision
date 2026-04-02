import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export function MoveListPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Move List</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-40 rounded-xl border border-border/70 p-3">
          <ol className="grid gap-2 text-xs text-muted-foreground">
            <li>1. e4 e5</li>
            <li>2. Nf3 Nc6</li>
            <li>3. Bb5 a6</li>
            <li>4. Ba4 Nf6</li>
            <li>5. O-O Be7</li>
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
