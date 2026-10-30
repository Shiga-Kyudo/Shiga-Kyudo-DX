# 滋賀大学体育会弓道部 開発引き継ぎ

## 起動

Node.js 22以上を使用します。追加パッケージのインストールは不要です。
このフォルダーをターミナルで開き、以下を実行します。

```powershell
npm start
```

ブラウザーで http://127.0.0.1:5173 を開きます。終了は Ctrl+C。
HTMLを保存してブラウザーを再読み込みすると変更が反映されます。

このプレビューはHTTPヘッダーのCSPでfetch・EventSourceなどの外部通信を遮断します。
本番データは表示されず、通信エラー・オフライン表示は想定内です。
端末内の試験入力はこのURLのlocalStorageに保存される場合があります。
同期・認証の動作確認には別のFirebase開発用プロジェクトが必要です。
index.htmlを直接開くと本番Firebaseへ接続するため、試験には上記URLを使います。

## 構成

- `index.html`: HTML・CSS・JavaScript・画像をまとめたアプリ本体。
- `tools/preview.cjs`: ローカル専用プレビューサーバー。HTML本体は変更せず配信時に案内を追加。
- `tools/check.cjs`: HTML内のJavaScript構文確認。
- 元の取得時点: `aab7d02`、v5.6.0 / build 283。
- 元リポジトリ: https://github.com/Shiga-Kyudo/Shiga-Kyudo-DX

HTML内に§01〜§23の目次があります。外観は先頭のstyle、処理はscript内です。
記録・部員などのデータ本体はFirebase Realtime Database、端末キャッシュはlocalStorageにあります。
GitHubのソース取得だけではFirebaseの管理権限やデータバックアップは引き継がれません。

## 確認と変更の保存

```powershell
npm run check
git diff
git status
```

構文確認は画面操作・同期のテストを代替しません。
変更は作業用ブランチで行い、確認後にコミット・プッシュします。
GitHub連携と、このPCのGitのプッシュ認証は別です。コミット用の名前・メールも未設定の場合は設定が必要です。

## Firebase管理画面で確認済み（2026年10月30日）

- プロジェクト `shiga-kyudo-dx` の管理画面を閲覧できることを確認。
- Realtime Database: `shiga-kyudo-dx-default-rtdb`、場所はシンガポール（asia-southeast1）。アプリの接続先と一致。
- ルート直下に `kyudo` ノードが存在。
- Authenticationの匿名プロバイダは有効。
- `/kyudo` のルール: `.read` は `auth != null`、`.write` は `auth != null && newData.exists()`。
- Firebase Hostingは「始める」画面。運用中サイトの公開先・更新方法は引き続き確認が必要。
- 概要画面のプラン表示はSpark。

上記は閲覧確認のみ。設定の変更、データの書き込み、データバックアップの取得は未実施。
匿名認証ユーザーにも上記ルールが適用されるため、部員・管理者の権限分離を確認する際はHTMLのPIN処理とデータベースルールを合わせて検討します。

## 残りの引き継ぎ事項

1. Firebase管理者としての役割（オーナー・編集者等）と今後のアカウント管理方法。
2. GitHub Pages設定で公開元ブランチ・フォルダー・デプロイ方式を確認（下記参照）。
3. データのバックアップ・復元手順、管理者の運用方法。
4. 開発用Firebaseの準備。本番データと分離して同期テストする。

パスワードや秘密鍵はリポジトリへ保存しません。

## 公開先と更新の流れ

- 運用中URL: https://shiga-kyudo.github.io/Shiga-Kyudo-DX/
- 公開基盤: GitHub Pages。
- 2026年10月30日にHTTP 200とv5.6.0 / build 283を確認。公開HTMLは取得済みのindex.htmlと改行形式を除いて一致。
- Firebaseはデータ保存・匿名認証に使用。HTMLの公開先はFirebase Hostingではありません。

公開設定の確認先:
https://github.com/Shiga-Kyudo/Shiga-Kyudo-DX/settings/pages

2026年10月31日、管理画面で公開元が main ブランチの /（ルート）、Deploy from a branch方式と確認しました。
更新前に上記設定を確認します。公開対象への変更反映は利用中サイトの更新につながります。

通常の作業の流れ:

1. 作業用ブランチでindex.htmlを編集。
2. `npm run check` と `npm start` で構文と画面を確認。
3. データ同期に関わる変更は開発用Firebaseで検証。
4. HTML内の§01の規約に従いAPP_VERSION / APP_BUILDを更新。
5. 変更内容を確認してコミット・プッシュし、公開対象ブランチへ反映。
6. GitHubのActionsまたはPages画面で公開処理の成功を確認し、公開URLのバージョンを確認。

公開対象: index.html、feedback.js、late-join.js。開発用ツールは本番HTMLから参照しません。
