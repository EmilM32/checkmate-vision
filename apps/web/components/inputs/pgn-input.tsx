import { Textarea } from "@workspace/ui/components/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export function PGNInputPlaceholder() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>PGN Input</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea placeholder="Wklej PGN..." className="min-h-24" readOnly />
      </CardContent>
    </Card>
  )
}
