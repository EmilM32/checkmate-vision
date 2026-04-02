import { MainLayoutPlaceholder } from "@/components/layout/main-layout"
import { AppProviders } from "@/context"

export default function Page() {
  return (
    <AppProviders>
      <MainLayoutPlaceholder />
    </AppProviders>
  )
}
