import { Chess } from "chess.js"
import { expect, test, type Page } from "@playwright/test"

// Long enough that 60 arrow steps stay inside the game.
const LONG_PGN = [
  "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7",
  "8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O",
  "14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5",
  "20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4",
  "25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4",
  "31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1",
  "36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1",
  "42. f4 f5 43. Kc1 Rd2 44. Qa7",
].join(" ")

type Sample = {
  top: number
  translateY: number
}

const READ_SAMPLE = `
  function translateYOf(transform) {
    if (transform === "none") return 0
    const open = transform.indexOf("(")
    const parts = transform
      .slice(open + 1, -1)
      .split(",")
      .map((part) => Number(part.trim()))
    if (transform.startsWith("matrix3d(") && parts.length === 16) return parts[13]
    if (transform.startsWith("matrix(") && parts.length === 6) return parts[5]
    return NaN
  }
  function readSample(el) {
    const box = el.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) return null
    return {
      top: box.top,
      translateY: translateYOf(getComputedStyle(el).transform),
    }
  }
`

function summarize(samples: Sample[]) {
  const tops = samples.map((sample) => sample.top)
  const min = Math.min(...tops)
  const max = Math.max(...tops)
  const maxShift = samples.reduce(
    (peak, sample) => Math.max(peak, Math.abs(sample.translateY)),
    0
  )
  return {
    count: samples.length,
    min,
    max,
    spread: max - min,
    maxShift,
  }
}

function expectStill(
  samples: Sample[],
  band: { minTop: number; maxTop: number }
) {
  const stats = summarize(samples)
  const detail = JSON.stringify(stats)
  expect(stats.count, detail).toBeGreaterThan(5)
  expect(stats.spread, detail).toBeLessThan(1)
  expect(stats.maxShift, detail).toBeLessThan(0.5)
  expect(stats.min, detail).toBeGreaterThanOrEqual(band.minTop)
  expect(stats.max, detail).toBeLessThanOrEqual(band.maxTop)
  return stats
}

async function installShellProbe(page: Page) {
  await page.addInitScript({
    content: `
      ${READ_SAMPLE}
      const samples = []
      window.__shellSamples = samples
      const read = () => {
        const el = document.querySelector("[data-testid=layout-shell]")
        if (!el) return
        const sample = readSample(el)
        if (sample) samples.push(sample)
      }
      const boot = () => {
        const observer = new MutationObserver(read)
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["style", "class"],
          childList: true,
          subtree: true,
        })
        read()
        const tick = () => {
          read()
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
      if (document.documentElement) boot()
      else document.addEventListener("DOMContentLoaded", boot)
    `,
  })
}

async function shellSamples(page: Page) {
  await page.waitForTimeout(500)
  return page.evaluate(() => {
    const target = window as Window & { __shellSamples?: Sample[] }
    return target.__shellSamples ?? []
  })
}

function fenAfterPlies(pgn: string, plies: number) {
  const game = new Chess()
  game.loadPgn(pgn)
  const moves = game.history()
  const replay = new Chess()
  for (let index = 0; index < plies; index++) {
    const san = moves[index]
    if (!san) throw new Error(`PGN has no ply ${index + 1}`)
    replay.move(san)
  }
  return replay.fen()
}

async function expectOpaqueStableShell(page: Page) {
  const client = await page.context().newCDPSession(page)
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 })
  await page.addInitScript(() => {
    const probe: {
      shell: number[]
      content: number[]
      shellNode: Element | null
      contentNode: Element | null
    } = {
      shell: [],
      content: [],
      shellNode: null,
      contentNode: null,
    }
    ;(
      window as Window & {
        __opacityProbe?: typeof probe
      }
    ).__opacityProbe = probe
    const remember = () => {
      const shell = document.querySelector("[data-testid=layout-shell]")
      if (!shell) return
      if (!probe.shellNode) probe.shellNode = shell
      if (!probe.contentNode && shell.firstElementChild) {
        probe.contentNode = shell.firstElementChild
      }
    }
    const read = () => {
      remember()
      if (probe.shellNode) {
        probe.shell.push(Number(getComputedStyle(probe.shellNode).opacity))
      }
      if (probe.contentNode) {
        probe.content.push(Number(getComputedStyle(probe.contentNode).opacity))
      }
      requestAnimationFrame(read)
    }
    const boot = () => {
      const root = document.documentElement
      if (!root) return
      const observer = new MutationObserver(remember)
      observer.observe(root, { childList: true, subtree: true })
      remember()
    }
    if (document.documentElement) boot()
    else document.addEventListener("DOMContentLoaded", boot)
    requestAnimationFrame(read)
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await page.waitForTimeout(500)
  const result = await page.evaluate(() => {
    const probe = (
      window as Window & {
        __opacityProbe?: {
          shell: number[]
          content: number[]
          shellNode: Element | null
          contentNode: Element | null
        }
      }
    ).__opacityProbe
    const shell = document.querySelector("[data-testid=layout-shell]")
    return {
      shell: probe?.shell ?? [],
      content: probe?.content ?? [],
      sameShell: shell !== null && shell === probe?.shellNode,
      sameContent:
        shell?.firstElementChild != null &&
        shell.firstElementChild === probe?.contentNode,
    }
  })
  const shellBelow = result.shell.filter((opacity) => opacity < 1)
  const contentBelow = result.content.filter((opacity) => opacity < 1)
  expect(shellBelow, JSON.stringify(result.shell.slice(0, 12))).toEqual([])
  expect(contentBelow, JSON.stringify(result.content.slice(0, 12))).toEqual([])
  expect(result.shell.length).toBeGreaterThan(5)
  expect(result.content.length).toBeGreaterThan(5)
  expect(result.sameShell).toBe(true)
  expect(result.sameContent).toBe(true)
}

test.describe("reduced motion layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await installShellProbe(page)
  })

  test("stays within the update limit while stepping a long game", async ({
    page,
  }) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })
    page.on("pageerror", (error) => {
      errors.push(`${error.name}: ${error.message}`)
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    await page.getByRole("button", { name: "Silnik", exact: true }).click()
    await page
      .locator("[data-testid=pv-score]:visible")
      .first()
      .waitFor({ timeout: 30_000 })

    const toggle = page.getByRole("button", { name: "Importuj partię" })
    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
      await toggle.click()
    }
    await page
      .locator('textarea[placeholder="Wklej PGN..."]:visible')
      .fill(LONG_PGN)
    await page.getByRole("button", { name: "Wczytaj PGN" }).click()
    await page
      .locator("ol:visible button", { hasText: /^e4$/ })
      .first()
      .waitFor()

    await page.keyboard.press("Home")
    for (let step = 0; step < 60; step++) {
      await page.keyboard.press("ArrowRight")
    }
    await page.waitForTimeout(3_500)

    const blob = errors.join("\n")
    expect(blob, blob).not.toMatch(/Maximum update depth/)
    expect(blob, blob).not.toMatch(/Minified React error #185/)
  })

  test("keeps the shell fully visible for the first 500ms", async ({
    page,
  }) => {
    await expectOpaqueStableShell(page)
  })

  test("keeps the board with the move list while the arrow repeats", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/")
    await page.getByRole("button", { name: "Silnik", exact: true }).click()
    await page
      .locator("[data-testid=pv-score]:visible")
      .first()
      .waitFor({ timeout: 30_000 })

    const toggle = page.getByRole("button", { name: "Importuj partię" })
    if ((await toggle.getAttribute("aria-expanded")) !== "true") {
      await toggle.click()
    }
    await page
      .locator('textarea[placeholder="Wklej PGN..."]:visible')
      .fill(LONG_PGN)
    await page.getByRole("button", { name: "Wczytaj PGN" }).click()
    await page
      .locator("ol:visible button", { hasText: /^e4$/ })
      .first()
      .waitFor()

    await page.keyboard.press("Home")
    const changes = await page.evaluate(async () => {
      const board = document.querySelector("[data-testid=board-position]")
      if (!board) return -1
      let updates = 0
      const observer = new MutationObserver(() => {
        updates += 1
      })
      observer.observe(board, {
        attributes: true,
        attributeFilter: ["data-fen"],
      })
      for (let step = 0; step < 30; step++) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "ArrowRight",
            bubbles: true,
          })
        )
        await new Promise((resolve) => setTimeout(resolve, 33))
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
      observer.disconnect()
      return updates
    })

    const expected = fenAfterPlies(LONG_PGN, 30)
    await expect(page.locator("[data-testid=board-position]")).toHaveAttribute(
      "data-fen",
      expected
    )
    await expect(
      page.locator("[data-testid=move-list]:visible").first()
    ).toHaveAttribute("data-ply", "30")
    await expect(
      page.locator("[data-testid=engine-position]:visible").first()
    ).toHaveAttribute("data-fen", expected)
    await page
      .locator("[data-testid=pv-score]:visible")
      .first()
      .waitFor({ timeout: 15_000 })
    expect(changes).toBeGreaterThanOrEqual(10)
  })

  test.describe("390px", () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test("keeps the page shell in place after load", async ({ page }) => {
      await page.goto("/")
      const reduced = await page.evaluate(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
      expect(reduced).toBe(true)

      const stats = expectStill(await shellSamples(page), {
        minTop: 7,
        maxTop: 9,
      })
      console.log(`shell 390 ${JSON.stringify(stats)}`)
    })

    test("keeps the mobile tab in place while it leaves", async ({ page }) => {
      await page.goto("/")
      const tab = page.getByRole("tab", { name: "Ruchy" })
      await expect(tab).toBeVisible()

      await page.evaluate((helpers) => {
        const install = new Function(`${helpers}
          const samples = []
          window.__tabSamples = samples
          const read = () => {
            document.querySelectorAll("[data-testid=mobile-tab-panel]").forEach((el) => {
              const sample = readSample(el)
              if (sample) samples.push(sample)
            })
          }
          const tick = () => {
            read()
            window.__tabProbe = requestAnimationFrame(tick)
          }
          tick()
        `)
        install()
      }, READ_SAMPLE)

      await tab.click()
      await expect(tab).toHaveAttribute("data-state", "active")
      await page.waitForTimeout(500)

      const samples = await page.evaluate(() => {
        const target = window as Window & {
          __tabSamples?: Sample[]
          __tabProbe?: number
        }
        if (target.__tabProbe) cancelAnimationFrame(target.__tabProbe)
        return target.__tabSamples ?? []
      })
      const stats = summarize(samples)
      const detail = JSON.stringify(stats)
      expect(stats.count, detail).toBeGreaterThan(5)
      expect(stats.spread, detail).toBeLessThan(1)
      expect(stats.maxShift, detail).toBeLessThan(0.5)
      console.log(`tab 390 ${JSON.stringify(stats)}`)
    })
  })

  test.describe("1440px", () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test("keeps the page shell in place after load", async ({ page }) => {
      await page.goto("/")
      const stats = expectStill(await shellSamples(page), {
        minTop: 19,
        maxTop: 21,
      })
      console.log(`shell 1440 ${JSON.stringify(stats)}`)
    })
  })
})

test.describe("full motion layout", () => {
  test("keeps the shell and its content fully visible", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await expectOpaqueStableShell(page)
    const reduced = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
    expect(reduced).toBe(false)
  })
})
