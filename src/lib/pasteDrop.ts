import { useEffect, useRef, useState, type DragEvent } from 'react'

const imageFilesOf = (dt: DataTransfer | null) =>
  [...(dt?.files ?? [])].filter((f) => f.type.startsWith('image/'))

/** True on devices with a mouse/trackpad, where paste and drag-and-drop make sense. */
export const hasPointer = () => window.matchMedia('(pointer: fine)').matches

// Only the most recently mounted listener gets the paste (e.g. the capture sheet over a detail page).
const pasteStack: { current: (files: File[]) => void }[] = []

addEventListener('paste', (e) => {
  const top = pasteStack.at(-1)
  const files = imageFilesOf(e.clipboardData)
  if (!top || !files.length) return
  e.preventDefault()
  top.current(files)
})

// A file dropped outside a drop area would make the browser leave the app to show the picture
for (const type of ['dragover', 'drop'] as const) {
  addEventListener(type, (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
  })
}

/** Calls `onFiles` when an image is pasted anywhere on the page (⌘V after a screenshot). */
export function usePasteImages(onFiles: (files: File[]) => void, enabled = true) {
  const ref = useRef(onFiles)
  useEffect(() => { ref.current = onFiles })
  useEffect(() => {
    if (!enabled) return
    const entry = ref
    pasteStack.push(entry)
    return () => { pasteStack.splice(pasteStack.lastIndexOf(entry), 1) }
  }, [enabled])
}

/** Drag-and-drop of image files onto an element. Spread `props` on it; `over` is true while hovering. */
export function useDropImages(onFiles: (files: File[]) => void, enabled = true) {
  const [over, setOver] = useState(false)
  const props = enabled
    ? {
        onDragOver: (e: DragEvent) => {
          if (![...e.dataTransfer.types].includes('Files')) return
          e.preventDefault()
          e.stopPropagation()
          setOver(true)
        },
        onDragLeave: (e: DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault()
          e.stopPropagation()
          setOver(false)
          const files = imageFilesOf(e.dataTransfer)
          if (files.length) onFiles(files)
        },
      }
    : {}
  return { over, props }
}
