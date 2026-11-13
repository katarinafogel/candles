/** Saves a file; on phones offers the system share sheet so it can go straight to a cloud or messenger. */
export async function saveFile(blob: Blob, filename: string, preferShare = false) {
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (preferShare && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches
