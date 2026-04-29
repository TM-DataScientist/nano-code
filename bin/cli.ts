import { parseArgs } from 'util';
import { Agent } from '../src/core/agent';
import { loadInstructions } from '../src/core/prompt';
import { createModelFromEnv } from '../src/providers/modelFactory';
import { readFile, writeFile, editFile, execCommand } from '../src/tools';
import { createBranch, commitChanges, pushBranch } from '../src/tools/git';
import { createPullRequest, createIssueComment } from '../src/tools/github';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from '../src/config';

// 機密情報をマスクする（ログ出力用）
function maskSecret(value: string | undefined): string {
    if (!value) return '(未設定)';
    if (value.length <= 8) return '***';
    return value.slice(0, 4) + '***' + value.slice(-4);
}

// process.cwd() は CLI を起動した現在のディレクトリを返します。
// join(..., 'workspace') で、その直下にある workspace ディレクトリのパスをOSに合わせて組み立てます。
// Pythonなら Path.cwd() / "workspace" に近い処理です。
const WORKSPACE_ROOT = join(process.cwd(), 'workspace');

async function main() {
    // parseArgs はコマンドライン引数を解析するNode.js標準APIで、Pythonの argparse に近い役割です。
    // process.argv.slice(2) は `bun run bin/cli.ts` など実行コマンド部分を除き、ユーザーが渡した引数だけを取り出します。
    // values には --yolo のようなオプション、positionals にはオプションではない通常の引数が入ります。
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            // boolean オプションは指定されると true になり、未指定時は default の false になります。
            // allowed-domains は文字列を受け取るオプションです。
            'yolo': { type: 'boolean', default: false },
            'stream': { type: 'boolean', default: false },
            'responses': { type: 'boolean', default: false },
            'sandbox': { type: 'boolean', default: false },
            'allowed-domains': { type: 'string' },
        },
        // allowPositionals: true により、オプションではないタスク本文のような引数も許可します。
        allowPositionals: true,
    });

    const yoloMode = values['yolo'] ?? false;
    const streamMode = values['stream'] ?? false;
    const responsesMode = values['responses'] ?? false;

    // configに反映
    config.sandbox = values['sandbox'] ?? false;
    if (values['allowed-domains']) {
        // "example.com,api.example.com" のような文字列を split(',') で配列に分割します。
        // ... はスプレッド構文で、配列そのものではなく各ドメインを push の個別引数として渡します。
        // Pythonなら config.allowed_domains.extend(values["allowed-domains"].split(",")) に近い処理です。
        config.allowedDomains.push(...values['allowed-domains'].split(','));
    }

    // --- 入力の取得 ---
    // 1. CLI引数を優先
    // 2. なければ環境変数 ISSUE_BODY（手動入力）を使用
    // 3. なければ ISSUE_TEXT（Issue本文）があればIssue駆動モード
    let userPrompt = positionals.join(' ');
    // !userPrompt は「CLI引数でタスク本文が渡されていない」ことを表します。
    // process.env.ISSUE_BODY || process.env.ISSUE_TEXT は、どちらか片方でも値があればその文字列を返します。
    // 先頭の !! は文字列や undefined を true / false に変換する書き方で、Python の bool(...) に近いです。
    // つまりこの行は「CLI引数がなく、Issue由来の本文が環境変数にあるなら Issue駆動モード」と判定します。
    const isIssueDriven = !userPrompt && !!(process.env.ISSUE_BODY || process.env.ISSUE_TEXT);

    if (!userPrompt) {
        userPrompt = process.env.ISSUE_BODY || process.env.ISSUE_TEXT || '';
    }

    if (!userPrompt) {
        console.error('エラー: タスク内容を指定してください');
        console.error('使用法: bun run bin/cli.ts "タスク内容" [--yolo]');
        console.error('または環境変数 ISSUE_BODY を設定してください');
        process.exit(1);
    }

    // --- 環境設定 ---
    
    // ワークスペースディレクトリを作成
    if (!existsSync(WORKSPACE_ROOT)) {
        mkdirSync(WORKSPACE_ROOT, { recursive: true });
    }

    const provider = process.env.LLM_PROVIDER;
    const modelName = process.env.LLM_MODEL;
    const apiKey = process.env.LLM_API_KEY;

    // GitHub Actions環境での実行かどうかを簡易判定（CI=trueなど）
    const isCI = process.env.CI === 'true';

    console.log('=== Nano Code Agent ===\n');
    console.log(`Provider: ${provider || '(未設定)'}`);
    console.log(`Model: ${modelName || '(未設定)'}`);
    
    if (isCI) {
        console.log(`API Key: ${maskSecret(apiKey)}`);
        if (apiKey) {
            console.log(`::add-mask::${apiKey}`);
        }
    }
    
    console.log(`Workspace: ${WORKSPACE_ROOT}`);
    if (isIssueDriven) {
        console.log('[モード] Issue駆動モード (CI)');
    }
    if (yoloMode) {
        console.log('[モード] 自動承認モード (--yolo)');
    }
    if (streamMode) {
        console.log('[モード] ストリーミングモード (--stream)');
    }
    if (responsesMode) {
        console.log('[モード] Responses API使用 (--responses)');
    }
    if (config.sandbox) {
        console.log('[モード] サンドボックスモード (--sandbox)');
    }
    console.log(`Task: ${userPrompt.slice(0, 100)}${userPrompt.length > 100 ? '...' : ''}\n`);

    if (!provider || !modelName || !apiKey) {
        console.error('[ERROR] LLM設定が不足しています');
        process.exit(1);
    }

    const model = createModelFromEnv({ useResponses: responsesMode });

    // --- プロンプトの切り替え ---
    // Issue駆動（CI実行）とそれ以外（ローカル実行）で指示を分ける
    const baseInstructions = loadInstructions(WORKSPACE_ROOT);

    const localInstructions = baseInstructions;

    const issueText = process.env.ISSUE_TEXT || '';
    const issueDrivenInstructions = `${baseInstructions}

## CI向け追加指示
あなたは GitHub Actions で実行される TypeScript コーディングエージェントです。Issue番号は ${process.env.ISSUE_NUMBER || '(なし)'} です（「(なし)」ならコメントは不要）。

## Issue本文（参照用）
${issueText}

- 作業を始める前に、必ずTODOリストを作成する。
- 次の順番で作業する: Issue理解 → ファイル読込 → 修正 → テスト → Gitコミット/プッシュ → PR作成 → Issueへ結果コメント。
- レポートは日本語で行うこと。`;

    const agent = new Agent({
        name: 'nano-code',
        model,
        instructions: isIssueDriven ? issueDrivenInstructions : localInstructions,
        tools: {
            readFile,
            writeFile,
            editFile,
            execCommand,
            createBranch,
            commitChanges,
            pushBranch,
            createPullRequest,
            createIssueComment,
        },
        maxSteps: 20,
        useStreaming: streamMode,
        // Yoloモードなら自動承認
        approvalFunc: yoloMode ? async (name) => {
            console.log(`[自動承認] ツール ${name} の実行を承認しました`);
            return true;
        } : undefined,
    });

    try {
        const result = await agent.generate(userPrompt);
        
        if (isCI) {
             console.log('\n' + '─'.repeat(60));
             console.log(`[完了] 正常終了`);
             if (result.usage) {
                 console.log(`[使用トークン] ${result.usage.totalTokens} tokens`);
             }
        }
    } catch (error) {
        console.error('\n' + '─'.repeat(60));
        console.error('[ERROR] エージェント実行中にエラーが発生しました\n');
        
        if (error instanceof Error) {
            let message = error.message;
            if (apiKey) {
                message = message.replace(new RegExp(apiKey, 'g'), maskSecret(apiKey));
            }
            console.error(`原因: ${message}`);
        }
        process.exit(1);
    }
}

main();
