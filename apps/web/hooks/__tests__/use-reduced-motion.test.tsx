import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"
import { act } from "react"
import { createRoot, hydrateRoot, type Root } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion"

const require = createRequire(import.meta.url)
const motionDomState = pathToFileURL(
  join(
    dirname(require.resolve("framer-motion/package.json")),
    "../motion-dom/dist/es/render/utils/reduced-motion/state.mjs"
  )
).href

type MotionPreference = {
  hasReducedMotionListener: { current: boolean }
  prefersReducedMotion: { current: boolean | null }
}

const listeners = new Set<() => void>()
let matches = false

function installMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches:
        matches &&
        (query === "(prefers-reduced-motion: reduce)" ||
          query === "(prefers-reduced-motion)"),
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener)
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener)
      },
      addListener: (listener: () => void) => {
        listeners.add(listener)
      },
      removeListener: (listener: () => void) => {
        listeners.delete(listener)
      },
      dispatchEvent: () => false,
    }),
  })
}

async function resetLibraryPreference() {
  const state = (await import(
    /* @vite-ignore */ motionDomState
  )) as MotionPreference
  state.hasReducedMotionListener.current = false
  state.prefersReducedMotion.current = null
}

function Probe() {
  const reduce = usePrefersReducedMotion()
  return <p>{reduce ? "reduce" : "motion"}</p>
}

function assertNoUpdateLoop(errors: string[]) {
  const blob = errors.join("\n")
  expect(blob, blob).not.toMatch(/Maximum update depth/)
  expect(blob, blob).not.toMatch(/Minified React error #185/)
  expect(blob, blob).not.toMatch(/hydrat/i)
}

describe("usePrefersReducedMotion", () => {
  const roots: Root[] = []
  const hosts: HTMLElement[] = []

  beforeAll(() => {
    ;(
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(async () => {
    await act(async () => {
      for (const root of roots) root.unmount()
    })
    for (const host of hosts) host.remove()
    roots.length = 0
    hosts.length = 0
    listeners.clear()
    matches = false
  })

  it("hydrates the server markup when reduced motion is on, then follows it", async () => {
    matches = false
    installMatchMedia()
    await resetLibraryPreference()
    const html = renderToString(<Probe />)
    expect(html).toContain("motion")
    expect(html).not.toContain("reduce")

    matches = true
    await resetLibraryPreference()
    const host = document.createElement("div")
    host.innerHTML = html
    document.body.appendChild(host)
    hosts.push(host)
    const errors: string[] = []
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args.map((arg) => String(arg)).join(" "))
    })

    await act(async () => {
      roots.push(hydrateRoot(host, <Probe />))
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    spy.mockRestore()

    assertNoUpdateLoop(errors)
    expect(host.textContent).toBe("reduce")
  })

  it("updates when the preference changes", async () => {
    matches = false
    installMatchMedia()
    await resetLibraryPreference()
    const host = document.createElement("div")
    document.body.appendChild(host)
    hosts.push(host)
    await act(async () => {
      const root = createRoot(host)
      root.render(<Probe />)
      roots.push(root)
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(host.textContent).toBe("motion")

    matches = true
    await act(async () => {
      for (const listener of listeners) listener()
    })
    expect(host.textContent).toBe("reduce")
  })
})
