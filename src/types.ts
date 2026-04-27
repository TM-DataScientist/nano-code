// このファイルは、プロジェクト全体で共有する「型」を集めた場所です。
// Pythonでいう dataclass / TypedDict / Protocol に近い役割を、TypeScriptの type と interface で表しています。

// 第3章で定義： LLMが理解するツール定義（JSONスキーマ + 実行関数）
export type Tool = {
  // オブジェクトの各プロパティに `: string` のように型を書きます。
  name: string;
  description: string;
  // Record<string, unknown> は「文字列キーを持つ辞書」です。
  // Python の dict[str, Any] に近いですが、unknown は使う前に型確認が必要な安全寄りの型です。
  parameters: Record<string, unknown>;
  // Promise<string> は「非同期処理の結果として、後で string が返る」という意味です。
  execute: (args: Record<string, unknown>) => Promise<string>;
  // `?` は省略可能なプロパティです。Pythonの Optional というより「キーが無いこともある」に近いです。
  needsApproval?: boolean; // 第5章で定義
};

// 第3章で定義：LLMが発行するツール呼び出し
export type ToolCall = {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
};

// 第3章で定義：会話に追加されるツール実行結果
export type ToolResult = {
  toolCallId: string;
  result: string;
};

// 第3章で定義：モデルとやりとりするメッセージ構造
// `|` は union 型です。role の値によって、必要なプロパティが変わることを表します。
// これは Python の複数の TypedDict を Union する設計に近く、switch 文で role を見ると型が絞り込まれます。
export type Message =
  | { role: 'user' | 'system'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

// 使用量メタデータ（プロバイダ依存）
export type Usage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

// ストリーミングレスポンスの読み取り時に発行されるチャンク
// interface もオブジェクトの形を定義します。ここではストリームから流れてくる1イベントの形です。
export interface StreamChunk {
  kind: 'delta' | 'event' | 'done';
  text?: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
  usage?: Usage;
  toolCalls?: ToolCall[];
  error?: unknown;
}

// 統一されたLLMレスポンス
export type GenerateTextResult = {
  text: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';
  toolCalls?: ToolCall[];
  usage?: Usage;
};

// generateTextに渡すパラメータ
export type GenerateParams = {
  messages: Message[];
  tools?: Tool[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

// 各プロバイダが実装する言語モデルのインタフェース
// interface は「このメソッドを持っていれば LanguageModel として扱える」という契約です。
// OpenAI / Anthropic / Google の実装差を、この共通インターフェースで隠しています。
export interface LanguageModel {
  doGenerate(params: GenerateParams): Promise<GenerateTextResult>;
  // AsyncIterable は `for await...of` で1件ずつ非同期に受け取れる値です。
  // Python の async generator に近い使い方をします。
  doStream?(params: GenerateParams): AsyncIterable<StreamChunk>;
}

// モデルIDに紐づいた言語モデルを返すプロバイダファクトリ
export type Provider = (modelId: string) => LanguageModel;

// プロバイダ固有のエラーを公開する統一APIエラー
export class LLMApiError extends Error {
  constructor(
    // constructor 引数に `public` を付けると、同名のプロパティ定義と代入を同時に行います。
    // Pythonの `self.status = status` を短く書く構文だと考えると分かりやすいです。
    public status: number,
    public provider: string,
    public code?: string,
    message?: string,
    public raw?: unknown,
    public headers?: Record<string, string>
  ) {
    super(message || `LLM API Error: ${provider} returned ${status}`);
    this.name = 'LLMApiError';
  }
}
