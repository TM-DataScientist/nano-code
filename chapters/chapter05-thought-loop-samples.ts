import { readFile } from '../src/tools/readFile';
import { writeFile } from '../src/tools/writeFile';
import { execCommand } from '../src/tools/execCommand';
import { generateText } from '../src/core/generate-text';
import type { LanguageModel, Message, Tool } from '../src/types';

// 複数のサンプル関数で共通して使うツール一覧です。
// as unknown as Tool は、各ツールの具体的な型を、この章で使う共通の Tool 型として扱うための変換です。
const defaultTools: Tool[] = [
    readFile as unknown as Tool,
    writeFile as unknown as Tool,
    execCommand as unknown as Tool,
];

// 5.1節：シンプルなチャット（ツールなし、ループなし）
export async function simpleChat(
    model: LanguageModel,
    userMessage: string
): Promise<string> {
    // messages はLLMへ渡す会話履歴です。
    // system はAIの基本役割、user はユーザーからの入力を表します。
    const messages: Message[] = [
        { role: 'system', content: 'あなたは親切なアシスタントです。' },
        { role: 'user', content: userMessage },
    ];

    // generateText は、モデルに messages を送り、完成した回答をまとめて受け取ります。
    // maxTokens は、生成する長さの上限です。
    const response = await generateText({
        model,
        messages,
        maxTokens: 400,
    });

    // response.text にはLLMが生成した文章が入っています。
    return response.text;
}

// 5.2節：シンプルな思考ループ（ツールなし）
export async function chatLoop(
    model: LanguageModel,
    userMessage: string
): Promise<string[]> {
    // 会話履歴を配列として保持します。
    // ループの中で assistant の応答を追加しながら、次の生成に渡します。
    const messages: Message[] = [
        { role: 'system', content: 'あなたは親切なアシスタントです。' },
        { role: 'user', content: userMessage },
    ];

    // transcripts は、各ループで得られた応答テキストを保存する配列です。
    const transcripts: string[] = [];

    while (true) {
        // while (true) は、break されるまで繰り返すループです。
        // LLMが「終了」と判断するまで生成を続けます。
        const response = await generateText({
            model,
            messages,
            maxTokens: 400,
        });

        if (response.text) {
            // 空文字でない応答だけを記録します。
            transcripts.push(response.text);
        }

        if (response.finishReason === 'stop') {
            // finishReason が stop なら、モデルが自然に回答を終えたという意味です。
            break;
        }

        // まだ続きが必要な場合は、今回の応答を会話履歴に追加して次のループへ進みます。
        messages.push({
            role: 'assistant',
            content: response.text,
        });
    }

    return transcripts;
}

// 5.3節：1サイクルの動作（ツールを1回使う）
export async function singleCycleAgent(
    model: LanguageModel,
    userMessage: string
): Promise<void> {
    // このサンプルでは readFile だけをツールとして許可します。
    const tools: Tool[] = [readFile as unknown as Tool];

    // ツールを使えるアシスタントとして system メッセージで役割を伝えます。
    const messages: Message[] = [
        { role: 'system', content: 'あなたはファイル操作ができるアシスタントです。' },
        { role: 'user', content: userMessage },
    ];

    // tools を渡すことで、LLM は必要に応じてツール呼び出しを提案できます。
    const response = await generateText({ model, messages, tools });

    console.log('[LLM応答]', response.text);

    if (!response.toolCalls || response.toolCalls.length === 0) {
        // toolCalls がなければ、LLMはツール不要と判断したということです。
        console.log('[ツール呼び出し] なし');
        return;
    }

    // このサンプルは「1サイクル」なので、最初のツール呼び出しだけを実行します。
    const toolCall = response.toolCalls[0];
    if (!toolCall) {
        console.log('[ツール呼び出し] 空の配列');
        return;
    }
    console.log('[ツール要求]', toolCall.name, toolCall.args);

    // LLMが要求したツール名に一致する実体を、tools 配列から探します。
    const tool = tools.find((entry) => entry.name === toolCall.name);
    if (!tool) {
        throw new Error(`不明なツール: ${toolCall.name}`);
    }

    // 見つかったツールを実行し、結果の先頭100文字だけ表示します。
    const result = await tool.execute(toolCall.args);
    console.log('[ツール結果]', result.slice(0, 100));

    // ツールを呼び出した assistant メッセージを履歴に追加します。
    messages.push({
        role: 'assistant',
        content: response.text,
        toolCalls: response.toolCalls,
    });

    // ツールの実行結果も role: 'tool' のメッセージとして履歴に追加します。
    // toolCallId により「どのツール呼び出しへの結果か」を対応付けます。
    messages.push({
        role: 'tool',
        toolCallId: toolCall.toolCallId,
        name: toolCall.name,
        content: result,
    });

    console.log('1サイクル完了');
}

// 5.4節、5.6節：ツール実行関数（エラーハンドリング付き）
async function executeTool(tool: Tool, args: Record<string, unknown>): Promise<string> {
    try {
        // tool.execute はツール固有の処理を実行します。
        // args はLLMが指定した引数です。
        return await tool.execute(args);
    } catch (err: any) {
        // ツール実行に失敗してもプログラム全体を止めず、
        // エラー内容を文字列としてLLMへ返せる形にします。
        return `エラー: ${err?.message ?? '不明なエラー'}`;
    }
}

// 5.4節：ツール対応の思考ループ（原稿のgenerate関数に相当）
export async function agentLoop(
    model: LanguageModel,
    userMessage: string
): Promise<void> {
    // readFile / writeFile / execCommand をまとめた共通ツール一覧を使います。
    const tools = defaultTools;

    // LLMに渡す会話履歴を初期化します。
    const messages: Message[] = [
        { role: 'system', content: 'あなたはファイル操作ができるアシスタントです。' },
        { role: 'user', content: userMessage },
    ];

    while (true) {
        // 現在までの会話履歴とツール一覧をLLMへ渡します。
        // LLMは文章で答えるか、ツール呼び出しを要求します。
        const response = await generateText({ model, messages, tools, maxTokens: 400 });

        if (response.text) {
            console.log(`[LLM応答] ${response.text}`);
        }

        if (response.toolCalls && response.toolCalls.length > 0) {
            // ツール呼び出しがある場合、まず assistant の応答を会話履歴へ残します。
            messages.push({
                role: 'assistant',
                content: response.text,
                toolCalls: response.toolCalls,
            });

            // 複数のツール呼び出しが返ることもあるため、for...of で順番に実行します。
            for (const toolCall of response.toolCalls) {
                console.log(`[ツール実行] ${toolCall.name}`);
                const tool = tools.find((t) => t.name === toolCall.name);
                if (!tool) {
                    throw new Error(`不明なツール: ${toolCall.name}`);
                }
                const result = await executeTool(tool, toolCall.args);

                // 実行結果を role: 'tool' として履歴に追加します。
                // 次のループでLLMはこの結果を読んで、次の行動を決めます。
                messages.push({
                    role: 'tool',
                    toolCallId: toolCall.toolCallId,
                    name: toolCall.name,
                    content: result,
                });
            }

            // ツール結果を渡した状態で、もう一度LLMに続きを考えさせます。
            continue;
        }

        // ツール呼び出しがない通常応答も履歴に追加します。
        messages.push({
            role: 'assistant',
            content: response.text,
        });

        if (response.finishReason === 'stop') {
            // stop なら会話が完了したのでループを抜けます。
            break;
        }
    }
}
