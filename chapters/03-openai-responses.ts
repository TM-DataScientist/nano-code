import { generateText } from '../src/core/generate-text';
import { collectStreamResult } from '../src/core/generate-stream';
import { createOpenAIResponses } from '../src/providers/openai-responses';
import type { Message } from '../src/types';

// OpenAI の Responses API 版プロバイダーを使うサンプルです。
// 通常の一括応答と、ストリーミング応答の両方を同じモデルで試します。
async function main() {
    // AIへ送る会話履歴です。ここではユーザー発言が1つだけ入っています。
    const messages: Message[] = [
        { role: 'user', content: 'AIエージェントとは何ですか？' },
    ];

    // OPENAI_MODEL_ID が設定されていればそれを使い、なければ gpt-5-mini を使います。
    const modelId = process.env.OPENAI_MODEL_ID ?? 'gpt-5-mini';

    // createOpenAIResponses() は Responses API 用のプロバイダー作成関数です。
    // openai(modelId) で、generateText や collectStreamResult に渡せるモデルを作ります。
    const openai = createOpenAIResponses();
    const model = openai(modelId);

    console.log('--- OpenAI Responses (non-stream) ---');
    // non-stream は、回答が全部できあがってからまとめて受け取る方式です。
    const result = await generateText({ model, messages });
    console.log('Result:', result.text);
    console.log('FinishReason:', result.finishReason);
    console.log('ToolCalls:', result.toolCalls?.length ?? 0);

    console.log('\n--- OpenAI Responses (stream) ---');
    // stream は、回答が生成される途中の文字を少しずつ受け取る方式です。
    const streamed = await collectStreamResult({
        model,
        messages,
        onChunk: (chunk) => {
            if (chunk.kind === 'event') {
                // event は本文ではない通知です。ここでは reasoning として印を出しています。
                process.stdout.write('[reasoning]');
            }
            if (chunk.kind === 'delta' && chunk.text) {
                // delta.text は回答本文の断片です。届いた順に表示します。
                process.stdout.write(chunk.text);
            }
        },
    });

    // ストリーミング完了後に、終了理由とツール呼び出し数を確認します。
    console.log('\nFinishReason:', streamed.finishReason);
    console.log('ToolCalls:', streamed.toolCalls?.length ?? 0);
}

// 実行中にエラーが起きたら表示し、プロセスを失敗として終了します。
main().catch((err) => {
    console.error(err);
    process.exit(1);
});

