import { Agent } from '../src/core/agent';
import { createModelFromEnv } from '../src/providers/modelFactory';
import { readFile } from '../src/tools/readFile';
import { execCommand } from '../src/tools/execCommand';

// モック承認関数（自動承認）
// execCommand のような危険になり得るツールは、通常は実行前に承認を求めます。
// この検証では自動で承認して、エージェントの動作確認を簡単にしています。
const autoApprove = async (name: string, args: any) => {
    console.log(`[Auto-Approve] ${name}`);
    return true;
};

// 第8章のセキュリティ関連設定で、エージェントが正常にツールを使えるかを確認します。
async function main() {
    console.log('--- 第8章 検証開始 ---\n');

    // セキュリティテスト用のエージェントを作成します。
    const agent = new Agent({
        name: 'security-test-agent',
        model: createModelFromEnv(),
        // instructions は短くし、指定されたタスクをすぐ実行するようにしています。
        instructions: 'あなたはセキュリティテスト用のエージェントです。指示されたタスクを直ちに実行してください。',
        // readFile と execCommand だけを使えるようにします。
        tools: { readFile, execCommand },
        maxSteps: 5,
        approvalFunc: autoApprove,
    });

    try {
        // src ディレクトリの一覧表示を依頼します。
        // エージェントは必要に応じて execCommand を使います。
        await agent.generate('List files in src directory');
        console.log('✅ PASSED: Agent executed successfully');
    } catch (error: any) {
        // エラーが出た場合もスクリプト全体は落とさず、失敗として表示します。
        console.error(`❌ FAILED: ${error.message}`);
    }

    console.log('\n--- 第8章 検証完了 ---');
}

// main を実行します。
main();
