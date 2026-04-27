import { describe, expect, it } from 'bun:test';
import { collectStreamResult, generateStreamText } from './generate-stream';
import type { LanguageModel, StreamChunk, ToolCall } from '../types';

// ストリーミング処理の単体テストです。
// 実APIの代わりに async generator を持つモックモデルを使います。
describe('generateStreamText', () => {
    it('throws when model does not support streaming', async () => {
        const model: LanguageModel = {
            async doGenerate() {
                return { text: 'ok', finishReason: 'stop' };
            },
        };

        const iter = generateStreamText({
            model,
            messages: [{ role: 'user', content: 'hello' }],
        });

        await expect(async () => {
            // for await で全チャンクを読み切ろうとした時点で例外が出ることを確認します。
            for await (const _ of iter) {
                // no-op
            }
        }).toThrow('このモデルはストリーミングに対応していません');
    });
});

describe('collectStreamResult', () => {
    it('accumulates deltas and returns done payload', async () => {
        // delta チャンクを順に足し合わせると "Hello" になるテストデータです。
        const toolCalls: ToolCall[] = [
            {
                toolCallId: 'call_0',
                name: 'readFile',
                args: { path: 'hello.txt' },
            },
        ];

        const chunks: StreamChunk[] = [
            { kind: 'event' },
            { kind: 'delta', text: 'Hel' },
            { kind: 'delta', text: 'lo' },
            {
                kind: 'done',
                finishReason: 'tool_calls',
                usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
                toolCalls,
            },
        ];

        const model: LanguageModel = {
            async doGenerate() {
                return { text: 'ok', finishReason: 'stop' };
            },
            async *doStream() {
                // async generator で、用意した chunks を1つずつ返します。
                for (const chunk of chunks) {
                    yield chunk;
                }
            },
        };

        const seenKinds: string[] = [];
        const result = await collectStreamResult({
            model,
            messages: [{ role: 'user', content: 'hello' }],
            onChunk: (chunk) => seenKinds.push(chunk.kind),
        });

        expect(seenKinds).toEqual(['event', 'delta', 'delta', 'done']);
        expect(result).toEqual({
            text: 'Hello',
            finishReason: 'tool_calls',
            usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
            toolCalls,
        });
    });
});

