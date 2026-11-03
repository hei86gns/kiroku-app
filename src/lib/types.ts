export type FieldType =
  | 'text' | 'longtext' | 'number' | 'date' | 'select' | 'multiselect' | 'rating' | 'url' | 'image'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: string[]   // select / multiselect (not tags): this collection's own list
  unit?: string        // number: shown after the value, e.g. 円
  tag?: boolean        // multiselect: free-form tags, suggestions come from past values
  imageKind?: 'photo' | 'screenshot'
}

export type ViewMode = 'gallery' | 'list' | 'table'

export interface SavedView {
  view?: ViewMode
  sort?: string        // 'created' | field key
  filter?: string | null
  tag?: string | null
}

export type ThemeKey = 'recipe' | 'goods' | 'books' | 'all' | 'amber' | 'pink'

export interface Collection {
  id: string
  name: string
  en_name: string
  theme: ThemeKey
  icon: string
  title_label: string
  sub_field_key: string | null
  fields: FieldDef[]
  cover_field_key: string | null
  default_view: ViewMode
  saved_view: SavedView
  meta: { duration?: { start: string; finish: string } }
  sort_order: number
}

/** One stored image. `path` is the Storage object path; `thumb` a smaller copy for lists. */
export interface ImageRef {
  path: string
  thumb: string
  w: number
  h: number
}

export type FieldValue = string | number | string[] | ImageRef[] | null

export interface KRecord {
  id: string
  collection_id: string
  title: string
  data: Record<string, FieldValue>
  cover_image_key: string | null
  created_at: string
  updated_at: string
}

export type Tab = 'list' | 'search' | 'settings' | 'detail'
