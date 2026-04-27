import { collectStreamResult } from '../src/core/generate-stream';
import { createAnthropic } from '../src/providers/anthropic';
import { createGoogle } from '../src/providers/google';
import { createOpenAI } from '../src/providers/openai';
import type { Message } from '../src/types';

// 1つのプロバイダーに対してストリーミング生成を実行する関数です。
// label は画面表示用の名前、model は実際に使うLLM、messages はAIへ送る会話です。
async function runProvider(label: string, model: any, messages: Message[]) {
    console.log(`--- ${label} (stream) ---`);

    // collectStreamResult は、ストリーミングで少しずつ届く返答を受け取りながら、
    // 最終的な結果もまとめて返してくれるヘルパーです。
    const result = await collectStreamResult({
        model,
        messages,

        // onChunk は「返答の一部が届くたびに呼ばれる関数」です。
        // chunk.kind によって、通常の文字列なのか、イベント情報なのかを判定します。
        onChunk: (chunk) => {
            if (chunk.kind === 'event') {
                // event は、モデル内部の状態変化や推論イベントのような文字ではない通知です。
                process.stdout.write('[event]');
            }
            if (chunk.kind === 'delta' && chunk.text) {
                // delta は、回答本文の一部分です。
                // console.log ではなく process.stdout.write を使うと改行せずに続けて表示できます。
                process.stdout.write(chunk.text);
            }
        },
    });

    // ストリームが終わったあと、終了理由やツール呼び出し数、トークン使用量を表示します。
    console.log('\nFinishReason:', result.finishReason);
    console.log('ToolCalls:', result.toolCalls?.length ?? 0);
    console.log('Usage:', result.usage);
    console.log();
}

// main は3つのプロバイダーを順番にストリーミング実行します。
async function main() {
    // すべてのプロバイダーに同じ質問を送ります。
    const messages: Message[] = [
        { role: 'user', content: 'AIエージェントとは何ですか？' },
    ];

    // 環境変数があればそのモデル名を使い、なければデフォルト値を使います。
    const openaiModel = process.env.OPENAI_MODEL_ID ?? 'gpt-5-mini';
    const anthropicModel =
        process.env.ANTHROPIC_MODEL_ID ?? 'claude-3-haiku-20240307';
    const googleModel = process.env.GOOGLE_MODEL_ID ?? 'gemini-2.5-flash';

    // 各プロバイダー用のモデル作成関数を準備します。
    const openai = createOpenAI();
    const anthropic = createAnthropic();
    const google = createGoogle();

    // await を付けているため、OpenAI が終わってから Anthropic、最後に Google の順に実行されます。
    await runProvider('OpenAI', openai(openaiModel), messages);
    await runProvider('Anthropic', anthropic(anthropicModel), messages);
    await runProvider('Google', google(googleModel), messages);
}

// main の中で予期しないエラーが起きた場合はエラーを表示し、終了コード1で失敗を表します。
main().catch((err) => {
    console.error(err);
    process.exit(1);
});

