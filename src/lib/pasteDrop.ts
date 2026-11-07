import { useEffect, useRef, useState, type DragEvent } from 'react'

// Some browsers leave `files` empty for a pasted screenshot but still offer it in `items`
const imageFilesOf = (dt: DataTransfer | null) => {
  const files = [...(dt?.files ?? [])]
  if (!files.length) {
    for (const item of dt?.items ?? []) {
      const f = item.kind === 'file' ? item.getAsFile() : null
      if (f) files.push(f)
    }
  }
  return files.filter((f) => f.type.startsWith('image/'))
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')

/**
 * Pictures currently on the clipboard, read when a 貼り付け button is clicked.
 * Throws when the browser refuses access (the person declined, or an old browser).
 */
async function readClipboardImages(): Promise<File[]> {
  const files: File[] = []
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (type) files.push(new File([await item.getType(type)], `pasted.${type.split('/')[1]}`, { type }))
  }
  return files
}

export const NO_IMAGE = 'コピーされた画像がありません。スクショは ⌘+control+shift+4 で撮るとコピーされます。'
const NO_IMAGE_PHONE = 'コピーされた画像がありません。スクショを撮ったら左下の小さい画像 →「完了」→「コピーして削除」でコピーできます。'

/** The 貼り付け button: reads the clipboard and hands the pictures over (or explains why not). */
export async function pasteFromClipboard(onFiles: (files: File[]) => void, toast: (m: string) => void) {
  try {
    const files = await readClipboardImages()
    if (files.length) onFiles(files)
    else toast(hasPointer() ? NO_IMAGE : NO_IMAGE_PHONE)
  } catch {
    toast(hasPointer() ? 'ブラウザが貼り付けを許可しませんでした。⌘V でも貼り付けられます。' : '貼り付けできませんでした。出てきた「ペースト」を押してください。')
  }
}

/** True on devices with a mouse/trackpad, where ⌘V and drag-and-drop make sense. */
export const hasPointer = () => window.matchMedia('(pointer: fine)').matches

/** The 貼り付け button works here (PC and iPhone; iPhone asks with a 「ペースト」 bubble). */
export const canPaste = () => typeof navigator.clipboard?.read === 'function'

// Only the most recently mounted listener gets the paste (e.g. the capture sheet over a detail page).
// An empty list means something other than a picture was pasted outside a text box.
const pasteStack: { current: (files: File[]) => void }[] = []

addEventListener('paste', (e) => {
  const top = pasteStack.at(-1)
  if (!top) return
  const files = imageFilesOf(e.clipboardData)
  if (files.length) {
    e.preventDefault()
    top.current(files)
  } else if (!isTyping(e.target)) {
    top.current([])
  }
})

// A file dropped outside a drop area would make the browser leave the app to show the picture
for (const type of ['dragover', 'drop'] as const) {
  addEventListener(type, (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
  })
}

/** Calls `onFiles` when an image is pasted anywhere on the page (⌘V after a screenshot); [] when there was no image. */
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
