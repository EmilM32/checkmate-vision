import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export function NavigationControlsPlaceholder() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Navigation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Start
          </Button>
          <Button variant="outline" size="sm" disabled>
            Prev
          </Button>
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
          <Button variant="outline" size="sm" disabled>
            End
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
