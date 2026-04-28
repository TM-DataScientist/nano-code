import type { GenerateParams, GenerateTextResult, LanguageModel } from '../types';
import { retryWithExponentialBackoff } from '../utils/retry';

// `GenerateParams & { ... }` は交差型です。
// Pythonで例えると、既存の辞書型に `model` と `maxRetries` のキーを追加した形です。
export type GenerateTextParams = GenerateParams & {
    model: LanguageModel;
    maxRetries?: number;
};

// generateText は、どのLLMプロバイダーでも同じ形でテキスト生成を呼べるようにする薄いラッパーです。
//
// 【async と Promise の関係】
// `async` を付けた関数は「非同期関数」になります。非同期関数は処理を完了する前に一旦制御を返し、
// 処理が終わったら結果を届けます。その「いつか届く結果の入れ物」が `Promise` です。
// つまり `async function foo(): Promise<X>` は「Xを非同期で返す関数」という意味です。
//
// Python で例えると `async def generate_text(...) -> GenerateTextResult:` に近いですが、
// Python では戻り値型に `Coroutine` や `Awaitable` と書く必要はありません。
// TypeScript では明示的に `Promise<GenerateTextResult>` と書くルールになっています。
//
// 呼び出し側では `const result = await generateText(params)` と書くことで、
// Promise が解決されるまで待ち、解決後の値 `GenerateTextResult` を `result` に取り出せます。
// `await` を書かずに呼ぶと、result は `Promise<GenerateTextResult>` オブジェクトそのものになり
// テキストではなく「約束オブジェクト」が返ってきてしまうので注意が必要です。
export async function generateText(
    params: GenerateTextParams
): Promise<GenerateTextResult> {
    // 一時的なAPIエラーは retryWithExponentialBackoff が再試行します。
    // ここでは「実際にモデルへ問い合わせる関数」を無名関数として渡しています。
    return retryWithExponentialBackoff(
        () =>
            // LanguageModel の実体は OpenAI / Anthropic / Google などですが、
            // 共通メソッド doGenerate だけを使うため、呼び出し側はプロバイダー差を意識しません。
            params.model.doGenerate({
                messages: params.messages,
                temperature: params.temperature,
                maxTokens: params.maxTokens,
                tools: params.tools,
                signal: params.signal,
            }),
        params.maxRetries ?? 2
    );
}
