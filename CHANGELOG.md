# Change Log

## 2026-04-30 (14)

- `src/tools/webFetch.ts` の `targetUrl.hostname === domain || targetUrl.hostname.endsWith(...)` について、`===` が TypeScript の厳密等価演算子で Python の `==` に相当すること、TypeScript には `==`（型変換あり）と `===`（型変換なし）の2種類があり常に `===` を使うのがベストプラクティスであること、`endsWith` の先頭に `.` を付けることで "evil-example.com" の誤許可を防ぐ設計であることを補足しました。

## 2026-04-30 (13)

- `src/tools/webFetch.ts` の `targetUrl = new URL(url)` について、`URL` が Python の `urllib.parse.urlparse()` に相当する組み込みクラスであること、`new` がコンストラクタ呼び出しのキーワードであること、不正な URL 形式のとき例外を throw するためバリデーションを兼ねること、`let` が再代入可能な変数宣言で try 外で宣言して後続コードでも参照できる設計であることを補足しました。

## 2026-04-30 (12)

- `src/tools/webFetch.ts` の `config.allowedDomains.some(domain => ...)` について、`.some()` が Python の `any(condition(d) for d in ...)` に対応すること、アロー関数が Python の `lambda` に相当すること、`endsWith` によるサブドメイン判定、`||` が Python の `or` に対応することを補足しました。

## 2026-04-30 (11)

- `src/tools/webFetch.ts` の `const url = args.url as string` について、`as string` が Python にない概念の型アサーション（コンパイラへの宣言）であり実行時の変換は行わないこと、`unknown` 型の値を `string` として扱わせる意図であること、実際の値が文字列でなくても TypeScript はエラーを出さない点を補足しました。

## 2026-04-30 (10)

- `src/tools/webFetch.ts` の `typeof` について、値の型名を文字列で返す演算子であること、Python の `isinstance(x, str)` に近い役割を持つこと、`typeof "hello" → "string"` などの返り値一覧、`as string` との違い（コンパイル時の型強制 vs 実行時チェック）を補足しました。

## 2026-04-30 (9)

- `src/tools/webFetch.ts` の `async function webFetchExecute(args: Record<string, unknown>): Promise<string>` について、`async` が Python の `async def` に対応すること、`Record<string, unknown>` が Python の `dict[str, Any]` に近いが `unknown` は `any` より厳しく使用前に型チェックが必要なこと、`Promise<string>` が Python の `async def f() -> str:` に対応し `await` で `string` を取り出せることを補足しました。なお対象ファイルは `github.ts` ではなく `webFetch.ts` に存在します。

## 2026-04-30 (8)

- `src/tools/github.ts` の `JSON.parse(listResult || '[]')` について、`JSON.parse` が Python の `json.loads()` に相当すること、`||` が Python の `or` に近いフォールバック演算子であること、`gh` コマンドが空を返した場合も `'[]'` を渡すことで安全に空配列を返す設計であることを補足しました。

## 2026-04-30 (7)

- `src/tools/git.ts` の `createBranch` の `execute: async (args: { branchName: string }) => {` について、`execute` がツール実行時に Agent から呼ばれる非同期関数であること、`async` が Python の `async def` に対応すること、`args: { branchName: string }` が Python の TypedDict に近い引数の型注釈であること、`validateBranchName` が検証専用の `void` 関数で問題があれば `throw` する設計であることを補足しました。

## 2026-04-30 (6)

- `src/tools/git.ts` の `commitChanges` 内の `await execCommand.execute({ commandName: 'git', commandArgs: ['status', '--porcelain'] })` について、`--porcelain` がスクリプト向けの簡潔な出力形式であること、変更があれば行が返り・なければ空文字が返ること、`await` が Python の `await asyncio.coroutine()` に対応すること、`execCommand.execute` が stdout 文字列を返す Promise を返す処理であることを補足しました。

## 2026-04-30 (5)

- `src/tools/git.ts` の `writeTempFile` 内の `if (!existsSync(WORKSPACE_ROOT))` について、`existsSync` が Python の `os.path.exists()` に相当する同期的な存在確認であること、`!` で反転して「存在しない場合のみ」ディレクトリを作成する処理であること、`mkdirSync` の `{ recursive: true }` が Python の `Path(...).mkdir(parents=True, exist_ok=True)` に近いことを補足しました。

## 2026-04-30 (4)

- `src/tools/git.ts` の `function validateBranchName(name: string): void` について、`: void` が「値を返さない」という戻り値の型宣言であり、Python の `-> None` に対応することを補足しました。検証成功時は何も返さず終了し、失敗時は `throw` でエラーを投げる設計であること、`void` を明示することで呼び出し元が戻り値を使おうとするとコンパイルエラーになる点も追記しました。

## 2026-04-30 (3)

- `.github/workflows/nano-code.yml` の "Nano Code エージェントを実行" ステップの `env` に `GH_REPO` を追加しました。
  - `gh` CLI はフォーク上でデフォルトで upstream に PR を送る仕様のため、公式の環境変数 `GH_REPO` に自分のフォーク（`github.repository_owner/github.event.repository.name`）を設定することで、ワークフロー内の全 `gh` コマンドが Fork 元ではなく自分のフォークを対象にするよう固定しています。
  - ローカルターミナルで同様に固定したい場合は `export GH_REPO=TM-DataScientist/nano-code` をシェルプロファイル（`~/.bashrc` など）に追記してください。

## 2026-04-30 (2)

- `src/tools/github.ts` の `createPullRequest` を修正し、Fork 元（upstream）ではなく自分のフォークだけに PR を作成・操作できるようにしました。
  - **背景:** `gh pr create` はフォーク上ではデフォルトで upstream に PR を送ろうとします（GitHub CLI の仕様）。
  - **対応:** `GITHUB_REPO_OWNER` と `GITHUB_REPO_NAME` 環境変数が設定されているとき、`gh pr create` / `gh pr list` / `gh pr edit` に `--repo OWNER/NAME` を自動付与するようにしました。これらの変数は `nano-code.yml` の `env` セクションで `github.repository_owner` / `github.event.repository.name` から自動セットされます。
  - **ローカル実行への影響なし:** 環境変数が未設定の場合は空配列になるため、ローカルでの動作は従来通りです。
  - **エビデンス:** GitHub CLI のデフォルト挙動については公式ドキュメント（https://cli.github.com/manual/gh_pr_create）に記載されており、フォーク上では親リポジトリへの PR を優先する仕様となっています。

## 2026-04-30

- `.github/workflows/nano-code.yml` の全セクションに Python 開発者向けコメントを追加しました。`on:`（イベントトリガー）、`permissions:`（最小権限の原則）、`if:`（実行条件と`fromJSON`/`contains`）、`runs-on:`、`env:`（`secrets`/`vars`の違い）、`--yolo`フラグの意味を補足しました。

## 2026-04-29

- `bin/cli.ts` の `approvalFunc` に渡す `async (name) => { ... }` について、`name` はその場で代入する変数ではなく、Agent 側が `approvalFunc('readFile')` のように呼び出したときの引数を受け取る仮引数であることを補足しました。
- `bin/cli.ts` の `message.replace(new RegExp(apiKey, 'g'), maskSecret(apiKey));` について、エラーメッセージ内のAPIキーを正規表現で探し、ログ出力前にマスク済み文字列へ置換する処理であること、`'g'` が全一致箇所を対象にする指定であることを補足しました。
- `bin/cli.ts` の `approvalFunc: yoloMode ? async (name) => { ... } : undefined` について、`--yolo` 有効時だけツール実行を常に承認する非同期関数を Agent に渡し、無効時は `undefined` にする三項演算子の処理であることを補足しました。
- `bin/cli.ts` の `issueDrivenInstructions` について、バッククォートで囲まれた `## CI向け追加指示` 以下はコメントではなくテンプレートリテラルの複数行文字列であり、Issue駆動モード用の追加指示として Agent に渡されることを補足しました。
- `bin/cli.ts` の `isIssueDriven` 判定について、CLI引数の有無と `ISSUE_BODY` / `ISSUE_TEXT` の有無による `true` / `false` の判定表をコメントに追記しました。
- `bin/cli.ts` の `mkdirSync(WORKSPACE_ROOT, { recursive: true });` について、ワークスペースディレクトリを同期的に作成する処理であり、`recursive: true` により親ディレクトリもまとめて作成できること、Python の `Path(...).mkdir(parents=True, exist_ok=True)` に近いことを補足しました。
- `bin/cli.ts` の `const isIssueDriven = !userPrompt && !!(process.env.ISSUE_BODY || process.env.ISSUE_TEXT);` について、CLI引数がなく、`ISSUE_BODY` または `ISSUE_TEXT` がある場合に Issue駆動モードと判定する処理であること、`!!` が Python の `bool(...)` に近い boolean 化であることを補足しました。
- `bin/cli.ts` の `config.allowedDomains.push(...values['allowed-domains'].split(','));` について、カンマ区切りの文字列を配列に分割し、スプレッド構文で各ドメインを `allowedDomains` へ追加する処理であり、Python の `list.extend(...)` に近いことを補足しました。
- `bin/cli.ts` の `parseArgs({ args: process.argv.slice(2), options: ..., allowPositionals: true })` について、Node.js標準APIでCLI引数を解析し、`values` にオプション、`positionals` に通常引数を分ける処理であり、Python の `argparse` に近いことを補足しました。
- `bin/cli.ts` の `const WORKSPACE_ROOT = join(process.cwd(), 'workspace');` について、CLI 起動時のカレントディレクトリ直下にある `workspace` のパスを OS に合わせて組み立てる処理であり、Python の `Path.cwd() / "workspace"` に近いことを補足しました。
- `src/core/prompt.ts` の `fs.existsSync(agentsPath)` について、`AGENTS.md` のパスが存在するかを同期的に確認して `true` / `false` を返す処理であり、Python の `Path.exists()` や `os.path.exists()` に近いことを補足しました。
- `src/core/prompt.ts` の `const base = fs.readFileSync(basePath, 'utf-8');` について、`prompt.md` を同期的に読み込み、`'utf-8'` 指定により文字列として取得する処理であることを Python の `open(...).read()` と対応づけて補足しました。
- `src/core/prompt.ts` の `import.meta.url` について、今実行しているモジュールファイルの場所を URL 形式で表す値であることをコメントに追記しました。
- `src/core/prompt.ts` の `const __filename = fileURLToPath(import.meta.url);` について、ES Modules では `__filename` が標準で存在しないため、`import.meta.url` の `file:///...` URL を OS が扱える通常のファイルパスへ変換していることを補足しました。
- 添付画像の内容をもとに、`workspace/AGENTS.md` を作成し、プロジェクト概要・テスト・コーディング規約・編集方針をMarkdownで記載しました。
- `src/providers/modelFactory.ts` の `const openai = createOpenAIResponses({ apiKey });` について、OpenAI Responses API 用のモデル生成関数を作る処理であり、`{ apiKey }` が `{ apiKey: apiKey }` の省略記法であることを補足しました。
- `src/providers/modelFactory.ts` の `const useResponses = options?.useResponses ?? process.env.USE_RESPONSES_API === 'true';` について、引数指定を優先し、未指定なら環境変数を `'true'` と比較して boolean 化する処理であること、`?.` と `??` の役割を補足しました。
- `src/providers/modelFactory.ts` の `export function createModelFromEnv(options?: { useResponses?: boolean }): LanguageModel` について、他ファイルへ公開する `export`、省略可能引数 `options?`、省略可能プロパティ `useResponses?`、戻り値型 `LanguageModel` の意味を補足しました。
- `src/core/agent.ts` の `const tool = this.tools.find(t => t.name === toolCall.name);` について、Agent が持つツール一覧から要求名に一致する最初のツールを探す処理であり、Python の `next((...), None)` に近い検索であることを補足しました。
- `src/core/agent.ts` の `messages.push({ role: 'assistant', content: response.text || '', toolCalls: response.toolCalls })` について、assistant のツール呼び出し要求を会話履歴へ追加する処理であり、`push` が Python の `list.append(...)` に近いこと、`response.text || ''` が本文未設定時の空文字フォールバックであることを補足しました。
- `src/core/agent.ts` の `finishReason: 'stop' | 'max_steps' | 'length' | 'content_filter' | 'error';` について、5種類の文字列だけを許す文字列リテラルunion型であり、Python の `Literal[...]` に近い制約であることを補足しました。
- `src/core/agent.ts` の `middleMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0)` について、配列を1つの合計値へ畳み込む処理であり、Python の `sum(...)` に近いことを補足しました。
- `src/core/agent.ts` の `const removed = middleMessages.shift();` について、配列先頭の要素を取り出しつつ削除する処理であり、Python の `pop(0)` に近く、中間履歴の古いメッセージから捨てる意図であることを補足しました。
- `src/core/agent.ts` の `(systemMessage.content?.length || 0)` について、`content` があれば文字数を使い、なければ0を使うフォールバックであり、Python の `len(...) if ... else 0` に近いことを補足しました。
- `src/core/agent.ts` の `totalLength = ...` 再計算処理について、長いtool結果を省略した後に system / middle / recent の3ブロックの文字数を足し直すこと、`content?.length || 0` が content 未定義時に0文字扱いすることを補足しました。
- `src/core/agent.ts` の `middleMessages = middleMessages.map(msg => { ... })` について、配列の各要素を処理して新しい配列を作る `map` と、Python の小さな関数や `lambda` に近いアロー関数の意味を補足しました。
- `src/core/agent.ts` の `messages.slice(1, -4)` について、先頭の system メッセージと末尾4件の直近メッセージを除いた中間履歴を取り出し、その部分だけを圧縮・削除候補にする処理であることを補足しました。
- `src/core/agent.ts` の `messages.slice(-4)` について、配列末尾4件を取り出す書き方であり、Python の `messages[-4:]` に近いことと、直近の会話を圧縮・削除対象から外すために4件を残していることを補足しました。
- `src/core/agent.ts` の `constructor(config: AgentConfig)` について、new Agent(config) 直後に自動実行される初期化用メソッドであり、Python の `__init__` と同じように this.xxx へインスタンス専用の状態を保存する役割であることを補足しました。
- `src/core/approval.ts` の `new Promise((resolve) => { ... })` と `readline.createInterface({ input: process.stdin, output: process.stdout })` について、コールバックAPIを `await` しやすい Promise に包む考え方と、標準入力・標準出力を使ったCLI対話の作り方をPython経験者向けに補足しました。
- `chapters/04-tools-demo.ts` を `bun run chapters/04-tools-demo.ts` で実行し、`writeFile` / `readFile` / `execCommand` の基本動作と、パストラバーサル・コマンドインジェクション拒否の安全性チェックが成功することを確認しました。
- `src/tools/index.ts` の `import` と `export` の順番を慣習に合わせて `import` 先・`export` 後に並び替えました（動作は変わりません）。
- `src/tools/index.ts` の `export { X } from './X'` と `import { X } from './X'` について、再エクスポート（外部公開）と内部利用のインポートの違い、Python の `__init__.py` / `from .X import X` との対応、`index.ts` が窓口として個別パスを隠す役割を補足しました。
- `src/tools/execCommand.ts` の `child.on('close', (code: number | null) => {...})` について、プロセス終了時に発火する `'close'` イベント、`number | null` 型の終了コード（0=正常/null=シグナル終了）、`resolve`/`reject` が Python の `return`/`raise` に対応すること、`===`・テンプレートリテラル・三項演算子の意味を補足しました。
- `src/tools/execCommand.ts` の `child.stdout.on('data', (data: Buffer) => {...})` について、イベント駆動でチャンク単位に届く標準出力を受け取る仕組み、`Buffer` が Python の `bytes` に対応し `.toString()` が `.decode()` に相当すること、`MAX_OUTPUT_LENGTH` で出力を打ち切るフラグ処理を補足しました。
- `src/tools/execCommand.ts` の `spawn(commandName, commandArgs, { cwd, timeout, shell })` について、Python の `subprocess.Popen` に対応すること、各オプション（`cwd`/`timeout`/`shell: false`）の意味と `shell: false` がシェルインジェクション防止に重要である理由を補足しました。
- `src/tools/execCommand.ts` の `for (const arg of commandArgs)` について、Python の `for arg in list:` に対応する `for...of` ループであること、`const` がループ内の再代入を防ぐ宣言であること、各引数のパストラバーサルチェックが目的であることを補足しました。
- `src/tools/execCommand.ts` の `!ALLOWED_COMMANDS.includes(commandName)` について、`.includes(x)` が Python の `x in list` に対応し、`!` で反転することで「許可リストに含まれないコマンドはエラー」を意味することを補足しました。
- `src/tools/execCommand.ts` の `commandArgs = input.commandArgs as string[]` について、`as string[]` が実行時変換ではなく型アサーション（TypeScript への型の通知）であること、`Array.isArray` → `every` チェックの後で `unknown[]` を `string[]` と教える必要がある理由を補足しました。
- `src/tools/execCommand.ts` の `!input.commandArgs.every((arg) => typeof arg === 'string')` について、アロー関数が Python の `lambda`、`.every()` が `all()`、`!` が `not` に対応し、「1つでも string でない要素があればエラー」を意味することを補足しました。
- `src/tools/execCommand.ts` の `Array.isArray(input.commandArgs)` について、Python の `isinstance(x, list)` に対応する組み込み関数であること、`unknown` 型の値を配列メソッドで扱う前に必要な型ガードであること、省略時は `undefined` になりこの if をスキップして `commandArgs` が `[]` のまま使われることを補足しました。
- `src/tools/execCommand.ts` の `commandName = parts[0] || ''` について、`noUncheckedIndexedAccess` で `parts[0]` が `string | undefined` になるため `|| ''` で空配列時のフォールバックを行っていること、Python の `parts[0] if parts else ''` に対応することを補足しました。
- `src/tools/execCommand.ts` の `input.command` について、オブジェクトの `command` プロパティ参照であり Python の `input["command"]` や属性アクセスに近いことを補足しました。
- `src/tools/execCommand.ts` の `dangerousChars.test(command)` について、正規表現に一致する危険文字が含まれるかを返す判定であり Python の `re.search(...) is not None` に近いことを補足しました。
- `src/tools/execCommand.ts` の `const input = args as ExecCommandInput` について、`as` が実行時変換ではなく TypeScript への型アサーションであることを補足しました。

## 2026-04-28

- `src/tools/execCommand.ts` の `const ch = input[i] as string;` について、`noUncheckedIndexedAccess: true` により型が `string | undefined` になるためループ条件で安全を保証した上で `as string` で抑制していること、実行時には Python の `s[i]` 同様に長さ 1 の文字列であることを補足しました。
- `src/tools/execCommand.ts` の `if (ch === '\\' && quote === '"')` について、`'\\'` が TypeScript/JavaScript ではバックスラッシュ 1 文字を表すエスケープシーケンス（Python と同じ）であり、この条件が「ダブルクォート内のバックスラッシュ」を検出するため偽にはならないことを補足しました。

- `src/tools/execCommand.ts` の `tokens.push(current)` について、現在の引数を配列末尾へ追加する処理であり Python の `list.append(...)` に近いことを補足しました。
- `src/tools/execCommand.ts` の `let escaped = false` について、値を入れ替えられる `let` 変数であり、直前のバックスラッシュを覚える boolean フラグであることを補足しました。
- `src/tools/execCommand.ts` の `type Quote = '"' | "'" | null` について、引用符解析用の union 型であり Python の `Literal[...] | None` に近いことを補足しました。
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
