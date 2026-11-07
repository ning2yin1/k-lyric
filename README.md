# K-LYRIC

好きな曲の歌詞を読むことを中心にした、個人用の韓国語学習PWAです。日本語UI・iPhone Safari向け。HTML / CSS / JavaScriptのみで動き、アプリの実行にビルド・外部API・APIキーは不要です。

## 使い方

1. 「取り込み」で解析テンプレートをコピーし、ChatGPTに曲名・アーティスト名・歌詞とともに入力します。
2. 生成されたJSONを貼り付けます。同名・同アーティストの曲は確認後に上書きします。
3. ライブラリから曲を開き、歌詞・和訳を読むか、単語カードで学習します。カードをタップすると意味・発音・品詞を表示します。「詳しい解説」で全使用例を確認できます。
4. ♡で苦手マークを付けます。辞書形と正規化した品詞が一致するカードに全曲共通で反映されます。訳語の違いは同期を妨げません。明確な同形異義語は任意の `sense_id` をカードに指定して区別できます。使用例は曲ごとに独立しています。
5. 「✓ 覚えた」で習得済みの単語を通常のカード学習から除外できます。「苦手」と「覚えた」は排他的で、同じ識別キーを全曲で共有します。単語一覧と検索結果では覚えた単語も表示され、同じボタンを再度押すと未設定に戻せます。曲の詳細には登録・覚えた・未習得の単語数を表示します。
6. 「取り込み」下部で全曲と苦手マークをバックアップできます。復元は検証と確認後、現在のライブラリ全体を置き換えます。

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
PLAYWRIGHT_MODULE=/tmp/k-lyric-tools/node_modules/playwright node tests/mastered.cjs
PLAYWRIGHT_MODULE=/tmp/k-lyric-tools/node_modules/playwright node tests/words.cjs
```

`CHROMIUM_PATH` でブラウザ実行ファイル、`TEST_URL` で検証対象を指定できます。デフォルトは `/usr/bin/chromium` と `http://127.0.0.1:8000/k-lyric/` です。テストデータは一時的なブラウザプロファイル内にのみ保存します。

iPhone実機ではホーム画面への追加、ファイル保存・選択、セーフエリア、ソフトウェアキーボード、オフライン再起動を確認してください。Safariの実際の挙動はChromiumのモバイルエミュレーションとは異なる場合があります。

## データ形式

解析用JSONのスキーマとテンプレートは `data.js`、検証と保存処理は `store.js` にあります。バックアップは `app: "K-LYRIC"`, `version: 3`, `songs`, `weak`, `mastered`, `exportedAt` を含みます。不正なJSON・未対応バージョン・不正な曲や苦手キーは保存前に拒否します。復元は1回のIndexedDBトランザクションで行います。

既存のIndexedDBは初期化せず、`mastered` がない保存データは未習得として読み込みます。バージョン1のバックアップも引き続き復元できます（覚えた状態は空）。バージョン3では苦手と覚えたの重複を不正データとして拒否します。

## 全曲共通の学習状態と移行

単語一覧に横断検索と「すべて／苦手／覚えた」を統合しました。同一単語は1件にまとめ、タップすると全曲の使用例・訳・文法を確認できます。「苦手だけ学習」で復習できます。

同期は `wordKey` と `learningStatus` に集約し、辞書形のNFKC・前後空白・品詞の日本語/英語/韓国語表記を正規化します。日本語訳は文脈で変わるためキーに含めません。辞書形と品詞が同じでも別語義として扱う場合、カードに任意の `sense_id`（例：`"sense_id": "boat"`）を付けてください。異なる曲で同じ語義には同じIDを使います。訳語だけから意味の違いを自動推測しません。

旧キー（辞書形・品詞・意味）の記録は初回読み込み時に共通キーへ移行します。曲とカード・使用例は変更しません。移行はIndexedDBの単一トランザクションで保存し、失敗時には元の保存データを保持します。旧状態が衝突した場合は苦手を優先して復習対象に残し、元の両方の配列を `learningMigration` に保存します。この履歴もバージョン3のバックアップに含まれます。旧バージョン1・2のバックアップも同じルールで復元できます。
