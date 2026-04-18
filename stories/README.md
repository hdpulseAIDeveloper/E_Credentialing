# Component stories

CSF-3-format story files for the credentialing platform's design-system
primitives. See [ADR 0015](../docs/dev/adr/0015-design-system.md).

## How it works

- One `*.stories.tsx` file per component, colocated here at the repo root
  (deliberately outside `src/` so Next.js never bundles them).
- Every named export is a story (a React element).
- The Vitest harness at
  [`tests/unit/stories/render-stories.test.tsx`](../tests/unit/stories/render-stories.test.tsx)
  auto-discovers every `*.stories.tsx`, mounts each named export inside
  `<ThemeProvider>`, and asserts it renders without throwing.

## How to add a story

```tsx
// stories/my-thing.stories.tsx
import * as React from "react";
import { MyThing } from "@/components/my-thing";

export default { title: "Components/MyThing" };

export const Default = () => <MyThing label="hello" />;
export const Disabled = () => <MyThing label="hello" disabled />;
```

That's it — the next test run will discover and exercise it.

## Why no full Storybook UI yet?

ADR 0015 §D4 chose lite-Storybook for now because the full
`@storybook/nextjs` install adds ~25 dev deps and a parallel webpack
config that fights our tRPC + Auth.js providers. The upgrade trigger
is Wave 5.5 (customer-facing changelog page) when we'll want a public
component gallery URL.
