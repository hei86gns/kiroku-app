import type { Collection } from './types'
import { newId } from './fields'

/** The three collections created on first login (mirrors 記録アプリ仕様.md). */
export function defaultCollections(): Collection[] {
  return [
    {
      id: newId(),
      name: 'レシピ',
      en_name: 'RECIPES',
      theme: 'recipe',
      icon: 'recipe',
      title_label: '料理名',
      sub_field_key: null,
      cover_field_key: 'myPhoto',
      default_view: 'gallery',
      saved_view: { view: 'gallery', sort: 'created' },
      meta: {},
      sort_order: 0,
      fields: [
        { key: 'category', label: 'カテゴリ', type: 'multiselect', options: ['おかず', '主食', '汁物', '副菜', 'デザート'] },
        { key: 'source', label: '出典', type: 'select', options: ['クラシル', 'DELISH KITCHEN', '白ごはん.com', '自作'] },
        { key: 'rating', label: '評価', type: 'rating' },
        { key: 'url', label: 'URL', type: 'url' },
        { key: 'myPhoto', label: '自分の料理画像', type: 'image', imageKind: 'photo' },
        { key: 'recipePhoto', label: 'レシピ写真', type: 'image', imageKind: 'photo' },
        { key: 'ingShot', label: '材料スクショ', type: 'image', imageKind: 'screenshot' },
        { key: 'stepShot', label: '作り方スクショ', type: 'image', imageKind: 'screenshot' },
        { key: 'cookedOn', label: '料理日', type: 'date' },
        { key: 'ingredients', label: '食材', type: 'multiselect', tag: true },
        { key: 'seasonings', label: '調味料等', type: 'multiselect', tag: true },
        { key: 'notes', label: 'Notes', type: 'longtext' },
      ],
    },
    {
      id: newId(),
      name: '買ったもの',
      en_name: 'PURCHASES',
      theme: 'goods',
      icon: 'goods',
      title_label: '商品名',
      sub_field_key: null,
      cover_field_key: 'photo',
      default_view: 'gallery',
      saved_view: { view: 'gallery', sort: 'boughtOn' },
      meta: {},
      sort_order: 1,
      fields: [
        { key: 'category', label: 'カテゴリー', type: 'multiselect', options: ['キッチン', '収納', '家電', '日用品', '服'] },
        { key: 'url', label: 'URL', type: 'url' },
        { key: 'price', label: '価格', type: 'number', unit: '円' },
        { key: 'note', label: '備考', type: 'text' },
        { key: 'model', label: '型番', type: 'text' },
        { key: 'photo', label: '画像', type: 'image', imageKind: 'photo' },
        { key: 'shop', label: '購入店', type: 'select', options: ['Amazon', '無印良品', 'ヨドバシカメラ', 'ニトリ'] },
        { key: 'boughtOn', label: '購入日', type: 'date' },
      ],
    },
    {
      id: newId(),
      name: '読書記録',
      en_name: 'READING',
      theme: 'books',
      icon: 'books',
      title_label: '書名',
      sub_field_key: 'author',
      cover_field_key: 'cover',
      default_view: 'gallery',
      saved_view: { view: 'gallery', sort: 'finish' },
      meta: { duration: { start: 'start', finish: 'finish' } },
      sort_order: 2,
      fields: [
        { key: 'author', label: '著者', type: 'text' },
        { key: 'start', label: 'Start Reading', type: 'date' },
        { key: 'finish', label: 'Finish Reading', type: 'date' },
        { key: 'language', label: 'Language', type: 'select', options: ['日本語', 'English'] },
        { key: 'place', label: 'Place', type: 'text' },
        { key: 'price', label: 'Price', type: 'number', unit: '円' },
        { key: 'cover', label: 'カバー', type: 'image', imageKind: 'photo' },
        { key: 'memo', label: 'メモ', type: 'longtext' },
        { key: 'review', label: '内容・感想', type: 'longtext' },
        { key: 'rating', label: '評価', type: 'rating' },
      ],
    },
  ]
}

/** Icons a collection can use (drawn in components/Icons.tsx). */
export const ICON_KEYS = ['recipe', 'goods', 'books', 'film', 'place', 'note'] as const
