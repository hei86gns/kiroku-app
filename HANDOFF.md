# 記録アプリ（kiroku-app）引き継ぎメモ

最終更新：2026-11-03（モック完成、本実装はまだ）

## 今どこまで進んだか
| 段階 | 状態 |
|---|---|
| 仕様書の確認 | 済み → `記録アプリ仕様.md` |
| 実装計画 | 済み → `docs/plan-v1.md`（承認済み） |
| 触れるモック（見本） | **済み・ユーザーOK** → `docs/mockup.html` ／ 公開版 https://claude.ai/artifact/511ofcB1hrZz1uNi2ngXSj |
| 本実装（初版） | **次にやること**（計画の手順2から） |

Git：`main` ブランチ、リポジトリ単位で `user.name=heihachiro3` を設定済み。GitHub のリポジトリはまだ作っていない。

## 決定事項（仕様書に加えて、この会話で決めたこと）
- **作り方**：Kakeibo と同じ React 19 + TypeScript + Vite。GitHub Actions で GitHub Pages に公開（仕様書の「単一HTML」はやめた）
- **認証**：Kakeibo と同じ Supabase Auth（メール＋パスワード、招待制、新規登録画面なし）。Supabase は **プロジェクトB**（Kakeibo・tangocho などと共有）
  - 流用元：`~/Dev/Kakeibo_App/src/supabase.ts`、`src/pages/Login.tsx`、`src/App.tsx`（getSession / onAuthStateChange）、`src/db.ts`、`vite.config.ts`、`.github/workflows/deploy.yml`
  - `storageKey: 'sb-kiroku-auth-token'`（同じ github.io 上で他アプリとログイン情報が混ざらないようにするため）、`base: '/kiroku-app/'`
- **テーブル名**：`kiroku_` を先頭に付ける（`kiroku_collections` / `kiroku_records`）。RLS は `auth.uid() = user_id`
- **Storage バケット**：`kiroku-photos`（仕様書の `photos` から変更。共有プロジェクトで他のアプリと名前がぶつからないようにするため）。パスは `{user_id}/{collection_id}/{record_id}/{uuid}.jpg`
- **カレンダー表示**：初版ではやらない
- **Notion 連携**：初版ではつながない（段階2で取り込み、段階3で アプリ→Notion の一方通行の同期）。ユーザーには説明済み

## デザイン（モックで決めたこと）
実装では `docs/mockup.html` の CSS の色・文字の設定（`:root` の部分）をそのまま使う。
- **コレクションごとに色を変える**：レシピ `#f04a24`（トマトの赤）／買ったもの `#2f5bff`（コバルトの青）／読書記録 `#0e9a72`（深い緑）。全体・検索は `#6a4cff`。画面全体の色がコレクションに合わせて変わる（`data-c` 属性で切り替え）
- **明るい画面が基本**。右上のボタンで明るい／暗いを切り替える（`localStorage` の `kiroku-theme` に保存）。暗い画面は真っ黒にしない（背景 `#1c1e26`）
- **文字**：本文・見出しとも Zen Kaku Gothic New（見出しは太字 700）。数字・日付・「No.001」「06 RECORDS」などのラベルは IBM Plex Mono。※ Dela Gothic One は「太すぎる」と言われて不採用
- **一覧**：大きな見出し「レシピ.」＋コレクションごとの数字（レシピは平均の評価、買ったものは合計金額、読書は読了・読書中の冊数）。ギャラリーでは最新の1件を2枠分の大きさで表示
- **詳細画面**：PC（横幅820px以上）は左に写真・右に情報の2列で、写真は左に残る。スマホは写真の高さを画面の約半分（46vh）まで
- **下のメニュー**：画面から浮いた丸いメニュー（一覧／検索／＋／設定）。＋ボタンは今のコレクションの色
- **登録**：下から出てくるシートで、写真を選ぶ → 写真を入れる項目を選ぶ → タイトル → 保存したら、そのまま詳細の編集画面に移る

## ユーザーについて
- 非エンジニア寄り。説明は日本語で簡潔に、専門用語は噛み砕き、図（アスキーアート）を使う
- デザインには、「ワクワクするけどプロらしい」ものを求めている

## 次の会話での始め方
1. このメモ、`docs/plan-v1.md`、`記録アプリ仕様.md` を読む
2. 計画の **手順2（土台）** から実装を始める。大きな変更の前には必ずコミットする
3. Supabase の SQL（`supabase/schema.sql`）は、ユーザーが SQL Editor に貼り付けて実行する。Kakeibo と同じやり方
4. GitHub リポジトリを作るときは、公開にするか非公開にするかをユーザーに確認する
