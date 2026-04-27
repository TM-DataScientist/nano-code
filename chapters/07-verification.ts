import { Agent } from '../src/core/agent';
import { createModelFromEnv } from '../src/providers/modelFactory';

// モックツール
// 第7章では GitHub Actions 上でのPR作成フローを検証したいので、
// 実際の Git 操作や GitHub API 呼び出しはせず、同じ形の偽物ツールを用意しています。
const mockCreateBranchTool = {
    // name はLLMがツールを指定するときの名前です。
    name: 'createBranch',
    // description はLLMに「このツールは何をするものか」を説明する文章です。
    description: '新しい Git ブランチを作成する。既存のブランチがある場合はタイムスタンプを付与して作成する。',
    // needsApproval: true は、実行前に承認が必要な操作であることを表します。
    needsApproval: true,
    // parameters は、ツールが受け取る引数の形式をJSON Schema風に定義しています。
    parameters: {
        type: "object",
        properties: {
            branchName: { type: "string", description: "作成するブランチ名" }
        },
        required: ["branchName"]
    },
    // execute は、ツールが呼び出されたときに実行される関数です。
    // ここでは実際にブランチを作らず、ログを出して成功メッセージを返します。
    execute: async (args: any) => {
        console.log(`[Mock] createBranch called with: ${JSON.stringify(args)}`);
        return `ブランチを作成しました: ${args.branchName}`;
    }
};

const mockCommitTool = {
    name: 'commitChanges',
    description: 'メッセージ付きで変更をコミットする。変更がない場合はコミットしない。',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            message: { type: "string", description: "コミットメッセージ" },
            files: { type: "array", items: { type: "string" }, description: "ファイルリスト" }
        },
        required: ["message", "files"]
    },
    // コミットも実際には行わず、LLMから渡された引数を表示して結果文字列だけ返します。
    execute: async (args: any) => {
        console.log(`[Mock] commitChanges called with: ${JSON.stringify(args)}`);
        return `コミットしました: ${args.message}`;
    }
};

const mockPushBranchTool = {
    name: 'pushBranch',
    description: '現在のブランチをリモートリポジトリにプッシュする',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            branchName: { type: "string", description: "プッシュするブランチ名" }
        },
        required: ["branchName"]
    },
    // push のモックです。ネットワーク通信は発生しません。
    execute: async (args: any) => {
        console.log(`[Mock] pushBranch called with: ${JSON.stringify(args)}`);
        return `ブランチをプッシュしました: ${args.branchName}`;
    }
};

const mockCreatePullRequestTool = {
    name: 'createPullRequest',
    description: 'プルリクエストを作成する。',
    needsApproval: true,
    parameters: {
        type: "object",
        properties: {
            title: { type: "string" },
            body: { type: "string" },
            head: { type: "string" },
            base: { type: "string" }
        },
        required: ["title", "body", "head", "base"]
    },
    // PR作成も実際には行わず、成功したように見える固定メッセージを返します。
    execute: async (args: any) => {
        console.log(`[Mock] createPullRequest called with: ${JSON.stringify(args)}`);
        return `PR #123 を作成しました`;
    }
};

const mockReadFileTool = {
    name: "readFile",
    description: "ファイル読み込み",
    needsApproval: false,
    parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"]
    },
    // ファイル読み込みのモックです。
    // どのパスを指定しても、検証用の固定コードを返します。
    execute: async (args: any) => {
        console.log(`[Mock] readFile called with: ${JSON.stringify(args)}`);
        return "function hello() { console.log('hello'); }";
    }
};

// GitHub Actions でIssue対応からPR作成まで進む流れを、モックツールで検証します。
async function main() {
    console.log('--- Starting Chapter 7 Verification (Mock) ---\n');

    // エージェントに渡す作業依頼です。
    // 実際のファイル修正ではなく、モックツールを使って一連の流れを確認します。
    const userPrompt = "Issue #1: src/hello.ts の関数を修正して、'Hello World' と出力するようにしてください。その後PRを作成してください。";
    console.log(`Task: ${userPrompt}\n`);

    // Agent を作成します。
    // createModelFromEnv() により、使用するLLMは環境変数から決まります。
    const agent = new Agent({
        name: 'nano-code-action-mock',
        model: createModelFromEnv(),
        // instructions では、エージェントにIssue対応の手順を指定しています。
        instructions: `
あなたは GitHub Actions で実行される TypeScript コーディングエージェントです。

TODO:
1. [ ] Issue を理解する
2. [ ] 対象ファイルを読み込む
3. [ ] コードを修正する（今回はモックなので実際には修正しないが、コミットは行う）
4. [ ] Git にコミットしてプッシュする
5. [ ] プルリクエストを作成する

各TODOを完了したら「✓」をつけて、次のTODOに進んでください。
TODOリストを作成したら、すぐに最初のタスクを実行してください。
        `,
        // ここで登録したモックツールだけが、エージェントから呼び出せます。
        tools: {
            readFileTool: mockReadFileTool,
            createBranchTool: mockCreateBranchTool,
            commitTool: mockCommitTool,
            pushBranchTool: mockPushBranchTool,
            createPullRequestTool: mockCreatePullRequestTool,
        },
        maxSteps: 10,
        // approvalFunc は承認が必要なツールの実行可否を決める関数です。
        // この検証では自動で true を返し、すべて承認します。
        approvalFunc: async (name: string, _args: unknown) => {
            console.log(`[Auto-Approve] ${name}`);
            return true;
        }
    });

    try {
        // エージェントにタスクを渡して、ツール呼び出しを含む一連の処理を実行します。
        await agent.generate(userPrompt);
        console.log('\nVerification Completed Successfully');
    } catch (error) {
        console.error('\nVerification Failed:', error);
        process.exit(1);
    }
}

// main を実行します。
main();
