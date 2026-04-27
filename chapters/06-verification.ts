/**
 * 第6章 検証スクリプト
 * - createModelFromEnv() でマルチプロバイダー対応
 * - TODOリスト方式と結果報告フェーズ
 * - コンテキスト管理（manageContext）
 */
import { Agent } from '../src/core/agent';
import { createModelFromEnv } from '../src/providers/modelFactory';
import { readFile } from '../src/tools/readFile';
import { writeFile } from '../src/tools/writeFile';
import { editFile } from '../src/tools/editFile';
import { execCommand } from '../src/tools/execCommand';

// 第6章で作ったエージェント設定を実際に動かす検証スクリプトです。
async function main() {
    console.log('--- 第6章 検証開始 ---\n');

    // userPrompt は、エージェントへ渡す具体的な作業依頼です。
    const userPrompt = "src/calculator.ts の関数にテストを追加してください";
    console.log(`タスク: ${userPrompt}\n`);

    // 環境変数からモデルを生成（LLM_PROVIDER, LLM_MODEL, LLM_API_KEY）
    // どのプロバイダーを使うかをコードに固定せず、環境変数で切り替えられるようにしています。
    const model = createModelFromEnv();

    // 第6章で設計したinstructionsテンプレート
    // instructions はエージェントの行動ルールです。
    // TODOリストを作ること、編集時は editFile を優先すること、最後に報告することを指示しています。
    const instructions = `
あなたはTypeScriptのコーディングアシスタントです。

既存ファイルを編集する際は、writeFileではなくeditFileを優先的に使ってください。

作業を始める前に、必ず以下の形式でTODOリストを作成してください：

TODO:
1. [ ] タスクを理解する
2. [ ] 必要なファイルを読み込む
3. [ ] 適切な変更を加える
4. [ ] 動作を確認する

各TODOを完了したら「✓」をつけて、次のTODOに進んでください。

すべての作業が完了したら、以下の形式で結果を報告してください：

## 結果報告

### 実行したこと
- [変更したファイルと内容を列挙]

### 検証結果
- [テスト実行結果や動作確認の結果]

### 備考
- [問題が発生した場合や、追加で必要な作業があれば記載]
`;

    // エージェントを作成
    // Agent にモデル、指示、使えるツール、最大ステップ数を渡します。
    const agent = new Agent({
        name: 'nano-code',
        model,
        instructions,

        // tools に登録したものだけをエージェントが使えます。
        // ここではファイル読み書き、編集、コマンド実行を許可しています。
        tools: {
            readFile,
            writeFile,
            editFile,
            execCommand,
        },
        maxSteps: 15,
        verbose: true, // 完了時のサマリを表示
    });

    // 区切り線を表示して、ログを読みやすくしています。
    console.log('─'.repeat(60) + '\n');

    try {
        // agent.generate が、LLMの思考、ツール実行、最終応答までを進めます。
        const result = await agent.generate(userPrompt);
        console.log(result.text);
        console.log('\n' + '─'.repeat(60));
        console.log('検証完了');
    } catch (error) {
        // エラーが出た場合は失敗として表示し、終了コード1で終了します。
        console.error('\n検証失敗:', error);
        process.exit(1);
    }
}

// main を実行します。このファイルでは main 内の try/catch で主なエラーを処理しています。
main();
