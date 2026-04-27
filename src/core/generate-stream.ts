import type {
  GenerateParams,
  GenerateTextResult,
  LanguageModel,
  StreamChunk,
  ToolCall,
} from '../types';

export type GenerateStreamTextParams = GenerateParams & {
  model: LanguageModel;
};

// `async function*` は非同期ジェネレーターです。
// Python の `async def` + `yield` に近く、呼び出し側は `for await...of` で順番に受け取ります。
export async function* generateStreamText(
  params: GenerateStreamTextParams
): AsyncIterable<StreamChunk> {
  if (!params.model.doStream) {
    throw new Error('このモデルはストリーミングに対応していません');
  }

  // yield* は、別のジェネレーターが出す値をそのまま外側へ流します。
  // ここでは各プロバイダーの doStream が出すチャンクを、この関数の利用者へ中継しています。
  yield* params.model.doStream(params);
}

// ストリーミングは本来少しずつ値が届きますが、テストや通常処理では最後にまとめた結果も欲しくなります。
// collectStreamResult は、チャンクを逐次処理しながら最終的な GenerateTextResult に畳み込みます。
export async function collectStreamResult(
  params: GenerateStreamTextParams & {
    onChunk?: (chunk: StreamChunk) => void;
  }
): Promise<GenerateTextResult> {
  let text = '';
  let finishReason: StreamChunk['finishReason'];
  let usage: StreamChunk['usage'];
  let toolCalls: ToolCall[] | undefined;

  // `for await` は非同期に届く値を1つずつ待って処理する構文です。
  for await (const chunk of generateStreamText(params)) {
    if (params.onChunk) {
      // onChunk は画面表示などの副作用を差し込むためのコールバックです。
      params.onChunk(chunk);
    }

    if (chunk.kind === 'delta' && chunk.text) {
      text += chunk.text;
    }

    if (chunk.kind === 'done') {
      finishReason = chunk.finishReason;
      usage = chunk.usage;
      toolCalls = chunk.toolCalls;
    }
  }

  return {
    text,
    finishReason: finishReason ?? 'stop',
    usage,
    toolCalls,
  };
}
