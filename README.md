# K-LYRIC

好きな曲の歌詞を読むことを中心にした、個人用の韓国語学習PWAです。日本語UI・iPhone Safari向け。HTML / CSS / JavaScriptのみで動き、アプリの実行にビルド・外部API・APIキーは不要です。

## 使い方

1. 「取り込み」で解析テンプレートをコピーし、ChatGPTに曲名・アーティスト名・歌詞とともに入力します。
2. 生成されたJSONを貼り付けます。同名・同アーティストの曲は確認後に上書きします。
3. ライブラリから曲を開き、歌詞・和訳を読むか、単語カードで学習します。カードをタップすると意味・発音・品詞を表示します。「詳しい解説」で全使用例を確認できます。
4. ♡で苦手マークを付けます。辞書形・品詞・意味が一致するカードに全曲共通で反映されます。意味や品詞の表記が異なるカードは区別されます。使用例は曲ごとに独立しています。
5. 「取り込み」下部で全曲と苦手マークをバックアップできます。復元は検証と確認後、現在のライブラリ全体を置き換えます。

初回は著作権に問題のないオリジナル例文のデモ曲を表示します。曲の詳細画面から削除できます。一度削除したデモは再起動しても再追加されません。

## 保存とプライバシー

データは同じブラウザ・同じオリジンのIndexedDBにのみ保存されます。入力内容をリポジトリや外部サーバーに送信する処理はありません。ChatGPTへの入力は利用者が行います。解析結果の正確性は利用者が確認してください。

Safariのデータ削除、OSの容量整理、端末変更、別ブラウザ・別ドメインへの移動でデータにアクセスできなくなる場合があります。定期的にJSONバックアップを保存してください。iPhoneではダウンロードしたファイルを「ファイル」アプリから確認できます。復元には同じ画面のファイル選択を使います。

## ローカル起動

このクラウド環境では既存の `/workspace/k-lyric` を利用してください。タスク環境は隔離済みなので、追加のGit worktreeは不要です。

```sh
cd /workspace
python -m http.server 8000 --bind 0.0.0.0
```

ローカルブラウザで `http://localhost:8000/k-lyric/` を開きます。サブパスを含めて検証できます。Service WorkerはHTTPSまたはlocalhostでのみ有効です。

## GitHub Pages公開

`.github/workflows/pages.yml` はmainへのpushまたは手動実行で、アプリに必要な静的ファイルのみをデプロイします。

1. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。
2. 実装をmainへpushするか、Actionsの **Deploy K-LYRIC to GitHub Pages** を手動実行します。
3. Actionsが成功した後、 `https://ning2yin1.github.io/k-lyric/` を開きます。
4. iPhone Safariの共有メニューから「ホーム画面に追加」を選びます。

公開URLはデプロイ成功後に有効になります。環境の「Publish」は開発環境の保存であり、GitHub Pagesへの公開とは別です。

相対URLとハッシュによる画面遷移を採用しているため、`/k-lyric/` 配下で動作します。初回オンライン読み込み後、アプリ本体をキャッシュし基本操作をオフラインで利用できます。更新時に既存タブがある場合は全タブを閉じて再起動すると新しいService Workerが有効になります。

## 検証

実行時の依存関係はありません。自動テストだけPlaywrightとChromiumを使用します。

```sh
npm install --prefix /tmp/k-lyric-tools --cache /tmp/k-lyric-npm-cache playwright
# 上記HTTPサーバーを起動した状態で
cd /workspace/k-lyric
PLAYWRIGHT_MODULE=/tmp/k-lyric-tools/node_modules/playwright node tests/e2e.cjs
node --test tests/validation.test.mjs
```

`CHROMIUM_PATH` でブラウザ実行ファイル、`TEST_URL` で検証対象を指定できます。デフォルトは `/usr/bin/chromium` と `http://127.0.0.1:8000/k-lyric/` です。テストデータは一時的なブラウザプロファイル内にのみ保存します。

iPhone実機ではホーム画面への追加、ファイル保存・選択、セーフエリア、ソフトウェアキーボード、オフライン再起動を確認してください。Safariの実際の挙動はChromiumのモバイルエミュレーションとは異なる場合があります。

## データ形式

解析用JSONのスキーマとテンプレートは `data.js`、検証と保存処理は `store.js` にあります。バックアップは `app: "K-LYRIC"`, `version: 1`, `songs`, `weak`, `exportedAt` を含みます。不正なJSON・未対応バージョン・不正な曲や苦手キーは保存前に拒否します。復元は1回のIndexedDBトランザクションで行います。
