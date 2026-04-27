import type { GenerateParams, GenerateTextResult, LanguageModel } from '../types';
import { retryWithExponentialBackoff } from '../utils/retry';

// `GenerateParams & { ... }` は交差型です。
// Pythonで例えると、既存の辞書型に `model` と `maxRetries` のキーを追加した形です。
export type GenerateTextParams = GenerateParams & {
    model: LanguageModel;
    maxRetries?: number;
};

// generateText は、どのLLMプロバイダーでも同じ形でテキスト生成を呼べるようにする薄いラッパーです。
// async 関数なので戻り値は Promise になり、呼び出し側では `await generateText(...)` と書きます。
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
