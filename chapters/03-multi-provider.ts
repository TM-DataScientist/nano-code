import { generateText } from '../src/core/generate-text';
// import { createAnthropic } from '../src/providers/anthropic'; // APIキー未設定のためコメントアウト
// import { createGoogle } from '../src/providers/google';       // APIキー未設定のためコメントアウト
import { createOpenAI } from '../src/providers/openai';
import type { Message } from '../src/types';

// 実際のAPIを呼び出すためモックfetchは削除済み

// main は、このファイルを実行したときの中心になる処理です。
// ここでは同じ質問を OpenAI / Anthropic / Google の3つのプロバイダーへ送り、
// それぞれの返答を順番に表示します。
async function main() {
    // Message[] は「Message 型の値が入った配列」という意味です。
    // role: 'user' は、ユーザーからAIへ送る発言を表します。
    const messages: Message[] = [
        { role: 'user', content: 'AIエージェントとは何ですか？' }
    ];

    // process.env は環境変数を読むためのオブジェクトです。
    // ?? は「左側が null または undefined のときだけ右側を使う」演算子です。
    // つまり環境変数が設定されていればそれを使い、なければデフォルトのモデル名を使います。
    const openaiModel = process.env.OPENAI_MODEL_ID ?? 'gpt-5-mini';
    // const anthropicModel = process.env.ANTHROPIC_MODEL_ID ?? 'claude-haiku-4-5-20251001'; // APIキー未設定のためコメントアウト
    // const googleModel = process.env.GOOGLE_MODEL_ID ?? 'gemini-2.5-flash';                // APIキー未設定のためコメントアウト

    console.log('--- OpenAI ---');
    // createOpenAI() は OpenAI 用のモデル作成関数を返します。
    // openai(openaiModel) のように呼ぶと、generateText へ渡せるモデルになります。
    const openai = createOpenAI();
    try {
        // generateText は、指定したモデルとメッセージを使ってテキスト生成を実行します。
        // await を付けることで、APIから返答が戻るまで待ちます。
        const res1 = await generateText({ model: openai(openaiModel), messages });
        console.log('Result:', res1.text);
    } catch (error) {
        // try の中でエラーが起きると catch に移動します。
        // 1つのプロバイダーが失敗しても、次のプロバイダーの検証を続けられるようにしています。
        console.error('[OpenAI] error:', error);
    }

    // console.log('\n--- Anthropic ---');
    // Anthropic も OpenAI と同じ generateText の形で呼び出せるように、
    // createAnthropic() がプロバイダー差分を吸収しています。
    // const anthropic = createAnthropic();
    // try {
    //     const res2 = await generateText({ model: anthropic(anthropicModel), messages });
    //     console.log('Result:', res2.text);
    // } catch (error) {
    //     console.error('[Anthropic] error:', error);
    // }

    // console.log('\n--- Google ---');
    // Google も同じ messages を使って呼び出します。
    // 呼び出し側のコードを共通化できるのが Provider 抽象の目的です。
    // const google = createGoogle();
    // try {
    //     const res3 = await generateText({ model: google(googleModel), messages });
    //     console.log('Result:', res3.text);
    // } catch (error) {
    //     console.error('[Google] error:', error);
    // }
}

// main() を実行します。
// .catch(console.error) は、main の中で捕まえきれなかったエラーを表示するための保険です。
main().catch(console.error);
