# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```

## Release v1 Quality Gate

Run the full release gate from repository root:

```bash
pnpm release:check
```

Run smoke E2E from the web app:

```bash
pnpm --filter web test:e2e
```

## v1 Scope Constraints

- Multiplayer is out of scope for v1.
- Cloud storage is out of scope for v1.
- Session persistence is localStorage-only.
