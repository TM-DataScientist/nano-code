import { createOpenAI } from '../src/providers/openai';
import { Agent } from '../src/core/agent';
import { readFile, writeFile, editFile } from '../src/tools/index';

// エージェントにファイル作成タスクを依頼するデモです。
// 人間が細かい手順を書く代わりに、LLM がツールを選びながら作業します。
async function main() {
    // OpenAI プロバイダーを作成し、使うモデル名を指定します。
    const openai = createOpenAI();
    const model = openai('gpt-5-mini');

    console.log('--- エージェントデモ開始 ---\n');
    console.log('タスク: greeting.txtを作成し、"Hello, World!"を書き込んでから内容を読み出す。');

    // new Agent({...}) で、名前・モデル・指示・利用可能なツールをまとめて設定します。
    // その後 .generate(...) で実際のユーザー依頼を渡して実行します。
    await new Agent({
        // name はログや識別用のエージェント名です。
        name: 'nano-code',
        model,

        // instructions は、ユーザー依頼とは別に常にエージェントへ渡す基本方針です。
        // ここでは「必ずツールを使う」「完了形式を守る」などを指定しています。
        instructions: `
あなたはnano-code-cliのデモ用エージェントです。必ずツールを用いてタスクを完了してください。
完了前に途中報告で終了してはいけません。タスク完了後は以下の形式で報告します：

## 結果報告
- 作成したファイル: パスと内容の要約
- 実行した手順: 利用したツール名と目的
- エラー: 発生していれば概要、なければ「なし」

ツールに渡すパスはワークスペースルートからの相対パスです（workspace/ プレフィックスは不要）。`,

        // tools は、エージェントが呼び出せる機能の一覧です。
        // readFile は読み込み、writeFile は新規作成/上書き、editFile は既存ファイル編集に使います。
        tools: {
            readFile,
            writeFile,
            editFile
        },

        // maxSteps は、エージェントが考える・ツールを呼ぶ回数の上限です。
        // 無限ループを避けるために設定しています。
        maxSteps: 8,

        // verbose: true にすると、途中のツール呼び出しなどの詳細ログが表示されます。
        verbose: true
    }).generate(
        // generate に渡している文字列が、今回の具体的な依頼です。
        'greeting.txt を作成し、中身を "Hello, World!" にしてから内容を読み出して報告してください。ファイルの保存にはwriteFileツールを使ってください。'
    );

    console.log('\n--- エージェントデモ終了 ---');
}

// main を実行し、予期しないエラーが起きたら表示します。
main().catch(console.error);
