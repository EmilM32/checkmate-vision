import { toPng } from "html-to-image"

type ExportBoardPngOptions = {
  filename?: string
  pixelRatio?: number
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a")
  anchor.href = dataUrl
  anchor.download = filename
  anchor.click()
}

export async function exportBoardToPng(
  target: HTMLElement,
  options?: ExportBoardPngOptions
) {
  const dataUrl = await toPng(target, {
    cacheBust: true,
    pixelRatio: options?.pixelRatio ?? 2,
  })

  downloadDataUrl(
    dataUrl,
    options?.filename ?? `checkmate-board-${Date.now()}.png`
  )
}
