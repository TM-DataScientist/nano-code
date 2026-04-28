import type {
    GenerateParams,
    GenerateTextResult,
    LanguageModel,
    Provider,
    ToolCall,
    StreamChunk,
} from '../types';
import { LLMApiError } from '../types';
import Anthropic from '@anthropic-ai/sdk';

// Anthropicプロバイダーを作るときに渡せる設定オブジェクトの型です。
// Pythonで例えると、`{"apiKey": "...", "baseURL": "...", "maxRetries": 2}` のような
// 辞書に入れてよいキーと値の型を、事前に宣言しているものです。
// `export type` なので、この型は他ファイルから import して再利用できます。
export type ProviderConfig = {
    // `?` は省略可能という意味です。指定されなければ createAnthropic 側で環境変数や既定値を使います。
    apiKey?: string;
    // Anthropic互換APIやプロキシを使う場合に、接続先URLを差し替えるための任意設定です。
    baseURL?: string;
    // SDK内部の自動リトライ回数です。未指定の場合、このファイルでは 0 を使います。
    maxRetries?: number;
};

function mapAnthropicFinishReason(
    stopReason: string | null | undefined
): GenerateTextResult['finishReason'] {
    switch (stopReason) {
        case 'end_turn':
        case 'stop_sequence':
            return 'stop';
        case 'max_tokens':
            return 'length';
        case 'tool_use':
            return 'tool_calls';
        default:
            return 'stop';
	}
}

type NonSystemMessage = Exclude<
    // Exclude<A, B> は union 型 A から B に当てはまる型を取り除くユーティリティ型です。
    // Anthropic API では system を別パラメータで渡すため、通常メッセージから除外しています。
    GenerateParams['messages'][number],
    { role: 'system' }
>;

function mapMessages(messages: NonSystemMessage[]): Anthropic.MessageParam[] {
    // Nano Code共通の Message 形式を Anthropic Messages API の形式へ変換します。
    // Anthropicでは tool の結果も user role の tool_result として渡す点がOpenAIと違います。
    return messages.map((message): Anthropic.MessageParam => {
        if (message.role === 'assistant') {
            const content: Anthropic.ContentBlockParam[] = [];
            if (message.content) {
                content.push({ type: 'text', text: message.content });
            }
            if (message.toolCalls) {
                for (const tc of message.toolCalls) {
                    content.push({
                        type: 'tool_use',
                        id: tc.toolCallId,
                        name: tc.name,
                        input: tc.args,
                    });
                }
            }
            return { role: 'assistant', content };
        }

        if (message.role === 'tool') {
            return {
                role: 'user',
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: message.toolCallId,
                        content: message.content,
                    },
                ],
            };
        }

        return { role: 'user', content: message.content };
    });
}

export function createAnthropic(config: ProviderConfig = {}): Provider {
    const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    const baseURL = (config.baseURL ?? 'https://api.anthropic.com').replace(
        /\/v1\/?$/,
        ''
    );

    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY 環境変数が設定されていません');
    }

    const client = new Anthropic({
        apiKey,
        baseURL,
        maxRetries: config.maxRetries ?? 0,
    });

	return (modelId: string): LanguageModel => ({
	        async doGenerate(params: GenerateParams): Promise<GenerateTextResult> {
	            // system メッセージだけを抜き出し、Anthropic の system パラメータへ渡します。
	            // `(m): m is NonSystemMessage => ...` は filter 後の型を絞る型ガードです。
	            const systemMessages = params.messages.filter((m) => m.role === 'system');
	            const messages = params.messages.filter(
	                (m): m is NonSystemMessage => m.role !== 'system'
	            );
	            const maxTokens = params.maxTokens ?? 1024;
	            const system =
	                systemMessages.length > 0
	                    ? systemMessages.map((m) => ({
	                          // `as const` により type が任意の string ではなく 'text' 固定になります。
	                          type: 'text' as const,
	                          text: m.content,
	                      }))
	                    : undefined;

	            const tools =
	                params.tools && params.tools.length > 0
	                    ? params.tools.map((tool) => ({
	                          name: tool.name,
	                          description: tool.description,
	                          input_schema:
	                              tool.parameters as Anthropic.Tool.InputSchema,
	                      }))
	                    : undefined;

	            try {
	                const response = await client.messages.create(
	                    {
	                        model: modelId,
                        max_tokens: maxTokens,
                        ...(system && { system }),
                        messages: mapMessages(messages),
                        temperature: params.temperature,
                        ...(tools && { tools }),
                    },
                    { signal: params.signal }
                );

                const textBlocks = response.content.filter(
                    (block: any) => block.type === 'text'
                );
                const text = textBlocks.map((block: any) => block.text).join('');

                const toolUseBlocks = response.content.filter(
                    // SDKの型が広いため、この教材では any を使って content block を取り出しています。
                    // 実務ではSDKの詳細型を使ってさらに厳密にできます。
                    (block: any) => block.type === 'tool_use'
                );

	                const toolCalls: ToolCall[] | undefined =
	                    toolUseBlocks.length > 0
	                        ? toolUseBlocks.map((block: any) => ({
	                              toolCallId: block.id,
	                              name: block.name,
	                              args: block.input,
	                          }))
	                        : undefined;

	                const promptTokens =
	                    response.usage?.input_tokens ?? undefined;
	                const completionTokens =
	                    response.usage?.output_tokens ?? undefined;

	                return {
	                    text,
	                    finishReason: mapAnthropicFinishReason(response.stop_reason),
	                    usage: response.usage
	                        ? {
	                              promptTokens,
	                              completionTokens,
	                              totalTokens:
	                                  (promptTokens ?? 0) +
	                                  (completionTokens ?? 0),
	                          }
	                        : undefined,
	                    toolCalls,
	                };
	            } catch (error) {
                if (error instanceof Anthropic.APIError) {
                    const headers = error.headers
                        ? Object.fromEntries(error.headers.entries())
                        : undefined;
                    throw new LLMApiError(
                        error.status ?? 500,
                        'anthropic',
                        undefined,
                        error.message,
                        error.error,
                        headers
                    );
                }
                throw error;
            }
	        },
	        async *doStream(params: GenerateParams) {
	            // Anthropicのストリームは event.type ごとに意味が分かれます。
	            // text_delta は本文、input_json_delta はツール引数のJSON断片です。
	            const systemMessages = params.messages.filter((m) => m.role === 'system');
	            const messages = params.messages.filter(
	                (m): m is NonSystemMessage => m.role !== 'system'
	            );
	            const system =
	                systemMessages.length > 0
	                    ? systemMessages.map((m) => ({
	                          type: 'text' as const,
	                          text: m.content,
	                      }))
	                    : undefined;

            const tools =
                params.tools && params.tools.length > 0
                    ? params.tools.map((tool) => ({
                          name: tool.name,
                          description: tool.description,
                          input_schema: tool.parameters as Anthropic.Tool.InputSchema,
                      }))
                    : undefined;

            try {
                const stream = await client.messages.create(
                    {
                        model: modelId,
                        max_tokens: params.maxTokens ?? 4096,
                        ...(system && { system }),
                        messages: mapMessages(messages),
                        temperature: params.temperature,
                        stream: true,
                        ...(tools && tools.length > 0 && { tools }),
                    },
                    { signal: params.signal }
                );

                const toolCalls: Record<string, ToolCall> = {};
                const partialJsonBuffers: Record<string, string> = {};
                // content block の index と tool_use id を対応付けるための辞書です。
                const indexToId: Record<number, string> = {};
                let finishReason: StreamChunk['finishReason'];
                let usage: StreamChunk['usage'];

                for await (const event of stream) {
                    switch (event.type) {
                        case 'content_block_start':
                            if (event.content_block?.type === 'tool_use') {
                                const id = event.content_block.id;
                                indexToId[event.index] = id;
                                toolCalls[id] = {
                                    toolCallId: id,
                                    name: event.content_block.name,
                                    args: {},
                                };
                                partialJsonBuffers[id] = '';
                            }
                            break;

                        case 'content_block_delta':
                            if (event.delta?.type === 'text_delta') {
                                yield { kind: 'delta', text: event.delta.text };
                            }
                            if (event.delta?.type === 'input_json_delta') {
                                const id = indexToId[event.index];
                                const toolCall = id ? toolCalls[id] : undefined;
                                if (id && toolCall) {
                                    const buffer = (partialJsonBuffers[id] ?? '') + event.delta.partial_json;
                                    partialJsonBuffers[id] = buffer;
                                    try {
                                        toolCall.args = JSON.parse(buffer);
                                    } catch {
                                        // JSONが不完全な場合は次のデルタを待つ
                                    }
                                }
                            }
                            break;

	                        case 'message_delta': {
	                            if (event.delta?.stop_reason) {
	                                finishReason = mapAnthropicFinishReason(
	                                    event.delta.stop_reason
	                                );
	                            }
	                            if (event.usage) {
	                                usage = {
	                                    promptTokens:
	                                        event.usage.input_tokens ?? undefined,
	                                    completionTokens: event.usage.output_tokens,
	                                    totalTokens:
	                                        (event.usage.input_tokens || 0) +
	                                        (event.usage.output_tokens || 0),
	                                };
	                            }
	                            break;
	                        }

                        case 'message_stop': {
                            const toolCallList = Object.values(toolCalls);
                            yield {
                                kind: 'done',
                                finishReason,
                                usage,
                                toolCalls:
                                    toolCallList.length > 0
                                        ? toolCallList
                                        : undefined,
                            };
                            return;
                        }
                        default:
                            break;
                    }
                }
            } catch (error) {
                if (error instanceof Anthropic.APIError) {
                    const headers = error.headers
                        ? Object.fromEntries(error.headers.entries())
                        : undefined;
                    throw new LLMApiError(
                        error.status ?? 500,
                        'anthropic',
                        undefined,
                        error.message,
                        error.error,
                        headers
                    );
                }
                throw error;
            }
        },
    });
}
