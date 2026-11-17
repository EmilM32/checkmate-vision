import { expect, test, type Page } from "@playwright/test"

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

test.describe("reduced motion layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await installShellProbe(page)
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
