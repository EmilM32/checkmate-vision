import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

const TOOLBAR_ITEMS = ["Heatmap", "Arrows", "Sleuth", "Export", "Flip"]

export function ToolbarPlaceholder() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Toolbar</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          {TOOLBAR_ITEMS.map((item) => (
            <Button key={item} size="sm" variant="secondary" disabled>
              {item}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
