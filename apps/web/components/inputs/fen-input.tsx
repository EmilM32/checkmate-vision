import { Input } from "@workspace/ui/components/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export function FENInputPlaceholder() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>FEN Input</CardTitle>
      </CardHeader>
      <CardContent>
        <Input value="startpos" readOnly />
      </CardContent>
    </Card>
  )
}
