import type {
    GenerateParams,
    GenerateTextResult,
    LanguageModel,
    Provider,
    ToolCall,
    StreamChunk,
} from '../types';
import { LLMApiError } from '../types';
import OpenAI from 'openai';

export type ProviderConfig = {
    // 省略可能な設定です。未指定の場合は環境変数やデフォルトURLを使います。
    apiKey?: string;
    baseURL?: string;
    maxRetries?: number;
};

function mapOpenAIFinishReason(
    finishReason: string | null | undefined
): GenerateTextResult['finishReason'] {
    // OpenAI固有の終了理由を、このプロジェクト共通の finishReason に変換します。
    // 戻り値型の `GenerateTextResult['finishReason']` は、既存型の特定プロパティ型だけを再利用する書き方です。
    switch (finishReason) {
        case 'stop':
            return 'stop';
        case 'length':
            return 'length';
        case 'content_filter':
            return 'content_filter';
        case 'tool_calls':
            return 'tool_calls';
        default:
            return 'stop';
    }
}

function parseToolCallArgs(raw: string): Record<string, unknown> {
    // LLMから来るツール引数はJSON文字列です。
    // 壊れたJSONでもプログラム全体を落とさず、空オブジェクトとして扱います。
    try {
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function mapMessages(messages: GenerateParams['messages']) {
    // Nano Code共通の Message 形式を、OpenAI Chat Completions API の形式へ変換します。
    // switch で role を見ると、TypeScript が message の型を自動で絞り込みます。
    return messages.map((message): OpenAI.ChatCompletionMessageParam => {
        switch (message.role) {
            case 'assistant': {
                const tool_calls = message.toolCalls?.map(
                    (tc): OpenAI.ChatCompletionMessageFunctionToolCall => ({
                        id: tc.toolCallId,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.args),
                        },
                    })
                );
                return {
                    role: 'assistant',
                    content: message.content,
                    ...(tool_calls && tool_calls.length > 0 ? { tool_calls } : {}),
                };
            }
            case 'tool':
                return {
                    role: 'tool',
                    content: message.content,
                    tool_call_id: message.toolCallId,
                };
            case 'user':
                return { role: 'user', content: message.content };
            case 'system':
                return { role: 'system', content: message.content };
        }
    });
}

export function createOpenAI(config: ProviderConfig = {}): Provider {
    // `??` は null または undefined のときだけ右側を使う演算子です。
    // 空文字はそのまま空文字として扱われる点が `||` と違います。
    const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    const baseURL = config.baseURL ?? 'https://api.openai.com/v1';

    if (!apiKey) {
        throw new LLMApiError(401, 'openai', undefined, 'OPENAI_API_KEY環境変数が必要です');
    }

    const client = new OpenAI({
        apiKey,
        baseURL,
        maxRetries: config.maxRetries ?? 0,
    });

    const provider = (modelId: string): LanguageModel => ({
        async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
            // ツール定義がある場合だけ OpenAI の function calling 形式へ変換します。
            // `as const` は type が単なる string ではなく、文字列リテラル 'function' だと固定する指定です。
            const tools =
                params.tools && params.tools.length > 0
                    ? params.tools.map((tool) => ({
                          type: 'function' as const,
                          function: {
                              name: tool.name,
                              description: tool.description,
                              parameters: tool.parameters,
                          },
                      }))
                    : undefined;

            try {
                const completion = await client.chat.completions.create(
                    {
                        model: modelId,
                        messages: mapMessages(params.messages),
                        temperature: params.temperature,
                        ...(params.maxTokens !== undefined && {
                            max_completion_tokens: params.maxTokens,
                        }),
                        ...(tools && { tools }),
                    },
                    { signal: params.signal }
                );

                const choice = completion.choices[0];
                if (!choice) {
                    throw new LLMApiError(500, 'openai', undefined, 'APIからの応答がありません');
                }
                const message = choice.message;

                const functionToolCalls =
                    message.tool_calls?.filter(
                        (
                            tc
                        ): tc is OpenAI.ChatCompletionMessageFunctionToolCall =>
                            // `tc is ...` は型ガードです。
                            // filter 後の配列要素が function tool call だと TypeScript に伝えます。
                            tc.type === 'function'
                    ) ?? [];

                const toolCalls: ToolCall[] | undefined =
                    functionToolCalls.length > 0
                        ? functionToolCalls.map((tc) => ({
                              toolCallId: tc.id,
                              name: tc.function.name,
                              args: parseToolCallArgs(tc.function.arguments),
                          }))
                        : undefined;

                return {
                    text: message.content ?? '',
                    finishReason: mapOpenAIFinishReason(choice.finish_reason),
                    usage: completion.usage
                        ? {
                              promptTokens: completion.usage.prompt_tokens,
                              completionTokens: completion.usage.completion_tokens,
                              totalTokens: completion.usage.total_tokens,
                          }
                        : undefined,
                    toolCalls,
                };
            } catch (error) {
                if (error instanceof OpenAI.APIError) {
                    const headers = error.headers
                        ? Object.fromEntries(error.headers.entries())
                        : undefined;
                    throw new LLMApiError(
                        error.status ?? 500,
                        'openai',
                        error.code ?? undefined,
                        error.message,
                        error.error,
                        headers
                    );
                }
                throw error;
            }
        },
        async *doStream(params: GenerateParams): AsyncIterable<StreamChunk> {
            // ストリーミングではツール呼び出しの名前や arguments が複数チャンクに分かれて届くことがあります。
            // そのため toolCallBuffer に一時保存し、最後に ToolCall[] へ組み立てます。
            const tools =
                params.tools && params.tools.length > 0
                    ? params.tools.map((tool) => ({
                          type: 'function' as const,
                          function: {
                              name: tool.name,
                              description: tool.description,
                              parameters: tool.parameters,
                          },
                      }))
                    : undefined;

            try {
                const stream = await client.chat.completions.create(
                    {
                        model: modelId,
                        messages: mapMessages(params.messages),
                        temperature: params.temperature,
                        ...(params.maxTokens !== undefined && {
                            max_completion_tokens: params.maxTokens,
                        }),
                        stream: true,
                        stream_options: { include_usage: true },
                        ...(tools && { tools }),
                    },
                    { signal: params.signal }
                );

                const toolCallBuffer: Record<
                    string,
                    { id: string; name: string; argsText: string }
                > = {};
                let toolCallIndex = 0;
                let finishReason: StreamChunk['finishReason'];
                let usage: StreamChunk['usage'];

                for await (const chunk of stream) {
                    const choice = chunk.choices?.[0];

                    if (choice?.delta?.content) {
                        yield { kind: 'delta', text: choice.delta.content };
                    }

                    if (choice?.delta?.tool_calls) {
                        for (const tc of choice.delta.tool_calls) {
                            const key = tc.id || String(tc.index ?? toolCallIndex++);
                            const existing = toolCallBuffer[key] || {
                                id: tc.id || key,
                                name: '',
                                argsText: '',
                            };

                            if (tc.function?.name) existing.name = tc.function.name;
                            if (tc.function?.arguments) {
                                existing.argsText += tc.function.arguments;
                            }

                            toolCallBuffer[key] = existing;
                        }
                    }

                    if (choice?.finish_reason) {
                        finishReason = mapOpenAIFinishReason(choice.finish_reason);
                    }

                    if (chunk.usage) {
                        usage = {
                            promptTokens: chunk.usage.prompt_tokens,
                            completionTokens: chunk.usage.completion_tokens,
                            totalTokens: chunk.usage.total_tokens,
                        };
                    }
                }

                const toolCalls = Object.values(toolCallBuffer).map((tc) => ({
                    toolCallId: tc.id,
                    name: tc.name,
                    args: parseToolCallArgs(tc.argsText),
                }));

                yield {
                    kind: 'done',
                    finishReason,
                    usage,
                    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                };
            } catch (error) {
                if (error instanceof OpenAI.APIError) {
                    const headers = error.headers
                        ? Object.fromEntries(error.headers.entries())
                        : undefined;
                    throw new LLMApiError(
                        error.status ?? 500,
                        'openai',
                        error.code ?? undefined,
                        error.message,
                        error.error,
                        headers
                    );
                }
                throw error;
            }
        },
    });
    return provider;
}
