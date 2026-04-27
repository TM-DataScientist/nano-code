import { createOpenAI } from './openai';
import { createOpenAIResponses } from './openai-responses';
import { createAnthropic } from './anthropic';
import { createGoogle } from './google';
import type { LanguageModel } from '../types';

// 環境変数から利用するプロバイダーとモデルを選び、共通の LanguageModel を作る関数です。
// Pythonでいう factory function で、呼び出し側は OpenAI / Anthropic / Google の違いを意識せず使えます。
export function createModelFromEnv(options?: { useResponses?: boolean }): LanguageModel {
    const provider = process.env.LLM_PROVIDER;
    const modelName = process.env.LLM_MODEL;
    const apiKey = process.env.LLM_API_KEY;
    const useResponses = options?.useResponses ?? process.env.USE_RESPONSES_API === 'true';

    // 環境変数が足りない場合は早めに例外を投げ、原因を分かりやすくします。
    if (!provider) {
        throw new Error('LLM_PROVIDER 環境変数が設定されていません');
    }
    if (!modelName) {
        throw new Error('LLM_MODEL 環境変数が設定されていません');
    }
    if (!apiKey) {
        throw new Error('LLM_API_KEY 環境変数が設定されていません');
    }

    switch (provider.toLowerCase()) {
        // switch は Python の match に近い分岐です。
        // provider名を小文字にして、入力の大文字小文字差を吸収しています。
        case 'openai': {
            if (useResponses) {
                const openai = createOpenAIResponses({ apiKey });
                return openai(modelName);
            }
            const openai = createOpenAI({ apiKey });
            return openai(modelName);
        }
        case 'anthropic': {
            const anthropic = createAnthropic({ apiKey });
            return anthropic(modelName);
        }
        case 'google': {
            const google = createGoogle({ apiKey });
            return google(modelName);
        }
        default:
            throw new Error(`未対応のプロバイダ: ${provider}. 対応プロバイダ: openai, anthropic, google`);
    }
}

