# 記録アプリ（kiroku-app）初版 実装計画

## Context
Notion で管理してきたレシピ・買ったもの・読書記録を、iPhone/iPad だけで「撮る → 縮小 → 登録」できる専用アプリに移す。Mac を経由する手間をなくし、登録をやめてしまう状況を防ぐのが目的。仕様は `kiroku-app/記録アプリ仕様.md`。今回は段階1（初版）のみ。Notion 取り込み（段階2）・Notion 同期（段階3）・カレンダー表示は対象外。

## 決定済み
- 構成：**Kakeibo と同じ React 19 + TypeScript + Vite**（単一HTMLではない）。GitHub Actions → GitHub Pages
- 認証：Kakeibo と同じ **Supabase Auth（メール＋パスワード、招待制、新規登録画面なし）**、Supabase プロジェクトB を共有
- 最初に「触れる HTML モック」を作って見てもらってから本実装に入る

## 全体の形
```
iPhone/iPad (ホーム画面に追加)
 ┌─────────────────────────────────────────┐
 │ React SPA (PWA)                          │
 │  撮影 → 縮小(canvas) → 保存キュー(IndexedDB) │
 │                 │ オンライン時に自動送信   │
 └─────────────────┼───────────────────────┘
                   ▼
 Supabase (プロジェクトB・他アプリと共有)
   Auth / kiroku_collections / kiroku_records / Storage: kiroku-photos
```

## 手順

### 0. 準備
- `kiroku-app` で `git init`、仕様書を最初のコミット

### 1. 触れるHTMLモック（Artifact で公開・URLを共有）
- 仮データ入りの1ページ。スマホ幅で以下をタップ遷移できる：
  ギャラリー / リスト / 表 切替、＋登録フロー、詳細・編集、検索、項目設定
- 見てもらって修正 → OK が出たら本実装へ

画面イメージ（モックで具体化する）：
```
┌ ギャラリー ───────────┐ ┌ 登録 ───────────────┐ ┌ 詳細 ───────────────┐
│[レシピ▾]   🔍  ⚙     │ │ コレクション: レシピ │ │ ← 鶏の照り焼き   編集 │
│ [▦][☰][▤]  並替 絞込 │ │ ┌────┐┌────┐┌──┐ │ │ ┌──────────────┐ │
│ ┌──────┐┌──────┐   │ │ │ 📷 ││ 📷 ││＋│ │ │ │   カバー写真   │ │
│ │ 写真 ││ 写真 │   │ │ └────┘└────┘└──┘ │ │ └──────────────┘ │
│ │      ││      │   │ │ 画像の種類:         │ │ カテゴリ: おかず    │
│ └──────┘└──────┘   │ │  [自分の料理画像▾]  │ │ 評価: ★★★★☆      │
│ 照り焼き  肉じゃが    │ │ タイトル:           │ │ 食材: #鶏肉 #ねぎ   │
│ ★★★★   ★★★       │ │ [____________]   │ │ 材料スクショ ▸ 3枚  │
│                (＋)│ │      [ 保存 ]      │ │ 作り方スクショ ▸ 2枚│
└────────────────────┘ └──────────────────┘ └──────────────────┘
```

### 2. 土台
- Vite + React + TS 新規作成。Kakeibo から流用：
  - `Kakeibo_App/src/supabase.ts` の作り（`storageKey: 'sb-kiroku-auth-token'` に変更。同じ github.io 上で他アプリとログイン情報が混ざらないため）
  - `Kakeibo_App/src/pages/Login.tsx`（ログイン＋パスワードリセット、`redirectTo` を `/kiroku-app/` に）
  - `App.tsx` の `getSession` / `onAuthStateChange` による認証監視
  - `vite.config.ts`（`base: '/kiroku-app/'`、git ハッシュ埋め込み）、`.github/workflows/deploy.yml`、`.env.example`、oxlint
- 追加ライブラリ：`vite-plugin-pwa`（オフライン用の裏方プログラムとホーム画面アイコン設定を自動生成）、`idb`（IndexedDB を扱いやすくする小さな道具）

### 3. データベース（`supabase/schema.sql`、SQL Editor で手動実行 ※Kakeibo と同じ運用）
- `kiroku_collections`：id, user_id, name, icon, title_label, fields jsonb, cover_field_key, default_view, saved_view jsonb（フィルタ・並べ替え）, sort_order
- `kiroku_records`：id(uuid, 端末側で生成), user_id, collection_id, title, data jsonb, cover_image_key, notion_page_id(null可・unique), created_at, updated_at
- インデックス：`data` に GIN、`(user_id, collection_id)`
- RLS：Kakeibo と同じ `auth.uid() = user_id` ポリシー
- Storage：バケット名は他アプリと被らないよう **`kiroku-photos`**（仕様の `photos` から変更）。パス `{user_id}/{collection_id}/{record_id}/{uuid}.jpg`、先頭フォルダが自分の user_id のときだけ読み書き可
- 初回ログイン時、コレクションが無ければ3つ（レシピ／買ったもの／読書記録）を仕様の項目定義で自動作成

### 4. 中核ロジック（`src/lib/`）
- `fields.ts`：項目の型定義（text/longtext/number/date/select/multiselect/rating/url/image）と入力・表示部品の対応表
- `image.ts`：`createImageBitmap(file, { imageOrientation: 'from-image' })` で向きを補正 → canvas で縮小 → JPEG。写真は長辺1280/品質0.8、スクショ系項目は長辺1600（項目定義に `imageKind: 'photo' | 'screenshot'`）
- `queue.ts`：保存はまず IndexedDB に入れ、オンラインなら即送信／オフラインなら `online` イベント・アプリ起動時に再送。画像アップロード → レコード upsert の順。同じ id で upsert するので二重送信しても重複しない
- `db.ts`：Kakeibo の `src/db.ts` と同じ書き方で collections/records の読み書き
- 一覧データも IndexedDB にキャッシュし、オフラインでも閲覧可

### 5. 画面（`src/pages/`, `src/components/`）
- `Gallery`（ギャラリー/リスト/表 切替、コレクション切替、並べ替え・絞り込みの保存）
- `Capture`（＋ → コレクション選択 → `<input type="file" accept="image/*" multiple>` → 縮小 → 写真＋タイトルだけで保存 → そのまま詳細へ）
- `RecordDetail`（表示・編集、画像の追加/削除/並べ替え、タップで拡大、タグ入力は過去タグを候補表示しつつその場で追加、読書記録は Duration を自動計算表示）
- `Search`（全コレクション横断：タイトル・テキストのキーワード＋タグ・日付・評価で絞り込み）
- `Settings`（コレクションごとの項目の追加・変更・並べ替え、選択肢の管理、カバー項目の指定）
- デザイン：Kakeibo のテーマ（ダーク基調・テーマ色切替）に揃える

### 6. 公開
- GitHub に `kiroku-app` リポジトリ作成（公開/非公開は作成時に確認）、Secrets に Supabase URL / anon key を登録 → push で自動デプロイ
- `HANDOFF.md` と `CLAUDE.md` を Kakeibo と同じ形式で作成

## 確認方法
- `npm run build` と `npm run lint` が通る
- `npm run dev` をスマホ幅のブラウザで開き、ログイン → 3コレクションが自動作成される
- 写真を選んで登録 → Supabase の Storage に縮小済み JPEG（長辺1280/1600）、`kiroku_records` に行ができる。縦向き写真が横にならない
- 機内モード相当（DevTools のオフライン）で登録 → 画面に「未送信」表示 → オンラインに戻すと自動送信され、重複しない
- 別アカウントで他人のレコード・画像が見えない（RLS）
- デプロイ後、iPhone でホーム画面に追加して撮影→登録できる
