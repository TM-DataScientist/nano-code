# Change Log

## 2026-04-28

- `src/tools/editFile.ts` の `content.split(args.oldText)` について、Python の `split` と同様に区切り文字で分割し、`length - 1` で一致回数を数えていることを補足しました。
- `src/tools/readFile.ts` の `readFile` ツール定義について、Python の辞書に関数を値として入れる感覚に近いことを補足しました。
- `src/tools/readFile.ts` の `execute: readFileExecute` について、ツール実行時に呼ばれる関数を登録していることを補足しました。
- `src/tools/readFile.ts` の `if (!stat.isFile())` について、通常ファイルではないディレクトリや特殊ファイルを拒否するチェックであることを補足しました。
- `src/tools/readFile.ts` の `fs.stat(absolutePath)` について、ファイル本体を読む前に種類やサイズなどのメタ情報を取得する処理であることを補足しました。
- `src/tools/readFile.ts` のシンボリックリンク検証について、リンクが別ファイルへのショートカットであることと、`fs.realpath` で実パスを確認する理由を補足しました。
- `src/tools/readFile.ts` のパストラバーサル防止処理について、`../` によるワークスペース外ファイル参照攻撃の意味と防止理由を補足しました。
- `chapters/03-multi-provider.ts` の Anthropic・Google セクション（import・モデル変数・API呼び出しブロック）を、APIキー未設定のためコメントアウトしました。OpenAI のみ有効な状態にしています。
- `src/core/generate-text.ts` の `async 関数なので戻り値は Promise になり` について、`async`・`Promise<T>`・`await` の関係を Python との対比で補足するコメントを追加しました。
- `src/providers/anthropic.ts` の `export function createAnthropic` について、`export` の意味（他ファイルからのimport可能化）、ファクトリ関数パターン、デフォルト引数、戻り値型 `: Provider` の意味を説明するコメントを追加しました。

- `src/providers/anthropic.ts` の `mapMessages` について、外側の関数戻り値型 `Anthropic.MessageParam[]` と、`map` コールバックの戻り値型 `Anthropic.MessageParam` の違いを補足しました。
- `src/providers/anthropic.ts` の `mapMessages(messages: NonSystemMessage[]): Anthropic.MessageParam[]` について、`Anthropic.MessageParam[]` が戻り値の型であることを Python の型ヒントとの対応で補足しました。
- `src/providers/anthropic.ts` の `NonSystemMessage` について、`GenerateParams['messages'][number]` で配列要素の union 型を取り出し、`Exclude` で system メッセージを除外する流れを補足しました。
- `src/providers/anthropic.ts` の `mapAnthropicFinishReason` について、Anthropic API の `stop_reason` を Nano Code 共通の `finishReason` に変換する対応表コメントを追加しました。
- `src/providers/anthropic.ts` の `ProviderConfig` 型について、Python の辞書との対応、`export type`、省略可能プロパティ `?`、各設定値の使われ方を説明するコメントを追加しました。
- `src/providers/openai.ts` の `config.apiKey ?? process.env.OPENAI_API_KEY` について、Python の条件式との対応が分かる補足コメントを追加しました。
- `src` 配下の TypeScript 実装に、Python経験者が初めてTypeScriptを読む前提の補足コメントを追加しました。
- `type` / `interface` / union 型 / optional property / `Promise` / async generator / 型ガード / `as const` / `Record<string, unknown>` など、TypeScript特有の構文をコード中で説明しました。
- LLMプロバイダー変換、ツール実行、安全チェック、ストリーミング処理、テストコードの動作意図が追えるようにコメントを追加しました。
- `src/core/generate-stream.test.ts` の期待エラーメッセージを、実装が返す日本語メッセージに合わせました。
- 作業計画として `todo_src_comments_20260428.md` を追加しました。

## 2026-04-27

- Codex/Claude Code を API キーではなくサブスクのブラウザログインで使う方針に変更し、`.devcontainer/devcontainer.json` から `OPENAI_API_KEY` と `ANTHROPIC_API_KEY` の自動引き継ぎを削除しました。
- Codex と Claude Code の OAuth 認証情報が dev container の再作成後も残るよう、`/home/vscode/.codex` と `/home/vscode/.claude` を Docker volume として永続化しました。
- `.devcontainer/Dockerfile` の認証コメントを、Codex の ChatGPT プランログイン、Claude Code の Pro/Max ログイン、devcontainer で localhost callback が詰まる場合の手動コードフローに関する根拠へ更新しました。
- Codex CLI の OAuth callback で使われる `localhost:1455` がホストブラウザから dev container に届くよう、`forwardPorts` と `portsAttributes` を追加しました。
- `.devcontainer/Dockerfile` に、Dockerfile 初学者にも分かるように各命令の目的と注意点を説明するコメントを追加しました。
- `.devcontainer/devcontainer.json` の `build.dockerfile`、`workspaceFolder`、`remoteUser` と Dockerfile の対応関係を説明するコメントを追加しました。
- Dockerfile の実行命令自体は変更せず、開発コンテナの動作に影響しないコメント追加に限定しました。
