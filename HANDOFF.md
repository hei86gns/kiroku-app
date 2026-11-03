# 記録アプリ（kiroku-app）引き継ぎメモ

最終更新：2026-11-03（本実装の初版コードが完成。Supabase の準備と実機確認はまだ）

## 今どこまで進んだか
| 段階 | 状態 |
|---|---|
| 仕様書の確認 | 済み → `記録アプリ仕様.md` |
| 実装計画 | 済み → `docs/plan-v1.md`（承認済み） |
| 触れるモック（見本） | 済み・ユーザーOK → `docs/mockup.html` ／ 公開版 https://claude.ai/artifact/511ofcB1hrZz1uNi2ngXSj |
| 本実装（初版）コード | **済み**（計画の手順2〜5）。`npm run build` / `npm run lint` 通過 |
| Supabase に表を作る | **未**：ユーザーが `supabase/schema.sql` を SQL Editor で実行する |
| 実際に動かして確認 | **未**：表ができたら `npm run dev` でログイン→登録→オフライン送信を確認 |
| GitHub 公開（手順6） | **未**：リポジトリの公開/非公開をユーザーに確認してから |

Git：`main` ブランチ。`.env` は Kakeibo と同じプロジェクトBの値をコピー済み（Git には入らない）。

## 決定事項（仕様書に加えて決めたこと）
- **作り方**：Kakeibo と同じ React 19 + TypeScript + Vite。GitHub Actions で GitHub Pages に公開（仕様書の「単一HTML」はやめた）
- **認証**：Kakeibo と同じ Supabase Auth（メール＋パスワード、招待制、新規登録画面なし）。Supabase は **プロジェクトB**（Kakeibo・tangocho などと共有）
  - `storageKey: 'sb-kiroku-auth-token'`、`base: '/kiroku-app/'`
- **テーブル名**：`kiroku_collections` / `kiroku_records`。RLS は `auth.uid() = user_id`
- **Storage バケット**：`kiroku-photos`（非公開）。パスは `{user_id}/{collection_id}/{record_id}/{uuid}.jpg`、一覧用の小さい画像は同じ場所に `{uuid}.thumb.jpg`（長辺480px）
- **カレンダー表示**：初版ではやらない
- **Notion 連携**：初版ではつながない（段階2で取り込み、段階3で アプリ→Notion の一方通行の同期）

### 本実装で決めたこと（計画から追加・変更）
- コレクションの表に、計画の列に加えて `en_name`（上部の英語見出し）、`theme`（色）、`sub_field_key`（タイトル下の項目。読書記録の著者）、`meta`（読書記録の開始日/終了日の組 → Duration 計算）を追加
- 色は6種類から選べる：赤 `recipe` / 青 `goods` / 緑 `books` / 紫 `all` / 橙 `amber` / 桃 `pink`
- 詳細の編集は **自動保存**（入力が止まって0.7秒後）。「完了」でも保存
- 画像は非公開バケットなので **署名付きURL**（7日有効）で表示。URLは端末に6日間覚えておき、写真そのものはオフライン用に端末へ保存（Service Worker）
- 並べ替えの候補は項目から自動で作る（日付項目は新しい順、評価・数値は高い順、登録順）
- 絞り込みは「最初の選択項目（タグ以外）」と「最初のタグ項目」を自動で使う
- 新しいコレクションは設定画面の「＋ 新しいコレクション」から（画像・日付・評価・メモの4項目入りで作成）

## コードの地図
```
src/
 ├ App.tsx              ログイン監視＋画面切替（一覧/検索/設定/詳細）、下のメニュー
 ├ context.ts           画面間で共有するデータと操作
 ├ lib/
 │  ├ store.ts          データ管理の中心：端末の控え→サーバー読込、保存、自動再送
 │  ├ queue.ts          送信待ちキュー（IndexedDB）を順番に Supabase へ送る
 │  ├ local.ts          IndexedDB（未送信の写真・送信待ち・一覧の控え・署名URL）
 │  ├ db.ts             Supabase の読み書き
 │  ├ image.ts          写真の縮小（向き補正、1280/1600px、サムネ480px）
 │  ├ imageUrl.ts       写真の表示URL（端末の写真→覚えたURL→まとめて署名）
 │  ├ fields.ts         項目の型・並べ替え・タグ集計などの共通処理
 │  └ defaults.ts       初回ログイン時に作る3コレクション
 ├ pages/  CollectionView / RecordDetail / Search / Settings / Login
 └ components/  CaptureSheet（登録シート）/ FieldInputs / Lightbox / common / Icons
supabase/schema.sql     SQL Editor に貼って実行する
```

保存の流れ：
```
画面で保存 → すぐ画面に反映 → IndexedDB の送信待ちに入れる
                              │ オンライン / 再接続 / アプリを開き直したとき
                              ▼
            写真をアップロード → レコードを upsert（同じ id なので二重送信しても重複しない）
```

## デザイン（モックで決めたこと）
`src/index.css` はモックの CSS をそのまま移したもの（末尾に「app additions」として追加分）。
- コレクションごとに色を変える（`data-c` 属性で切り替え）。明るい画面が基本、右上で切替（`localStorage` の `kiroku-theme`）
- 文字：Zen Kaku Gothic New（見出しは 700）、数字・ラベルは IBM Plex Mono。Dela Gothic One は不採用
- 詳細画面は PC（820px以上）で2列、スマホは写真の高さ 46vh まで
- 登録：下から出るシート → 写真 → 写真を入れる項目 → タイトル → 保存したら詳細の編集画面へ

## ユーザーについて
- 非エンジニア寄り。説明は日本語で簡潔に、専門用語は噛み砕き、図（アスキーアート）を使う
- デザインには「ワクワクするけどプロらしい」ものを求めている

## 次にやること
1. **ユーザー**：Supabase（プロジェクトB）の SQL Editor で `supabase/schema.sql` を実行
2. `npm run dev` → ログイン → 3コレクションが自動作成されるか確認
3. 写真を選んで登録 → Storage に縮小済み JPEG とサムネ、`kiroku_records` に行ができるか。縦向き写真が横にならないか
4. DevTools でオフラインにして登録 → 「未送信」表示 → オンラインに戻すと自動送信され、重複しないか
5. 計画の手順6：GitHub リポジトリ作成（**公開/非公開をユーザーに確認**）→ Secrets に `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` → push で自動公開 → iPhone でホーム画面に追加して確認
6. 気になっている点（実機確認後に判断）：
   - JS が約500KB（gzip 143KB）。Supabase ライブラリが大きいため。必要なら画面ごとに分割読み込み
   - 項目を削除しても、入力済みの値はデータに残る（画面に出ないだけ）
   - 戻るジェスチャー（ブラウザの履歴）には未対応。画面左上の「‹」で戻る
