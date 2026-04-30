import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execCommand } from './execCommand';

const WORKSPACE_ROOT = join(process.cwd(), 'workspace');

// `: void` は「この関数は値を返さない」という戻り値の型宣言です。
// Python の `def validate(...) -> None:` に対応します。
// この関数は検証に成功すれば何も返さず終了し、失敗すれば throw でエラーを投げます。
// TypeScript では void を書くことで呼び出し元が戻り値を使おうとするとコンパイルエラーになります。
function validateBranchName(name: string): void {
    // Gitコマンドへ渡す文字列なので、長さ・先頭文字・使える文字を事前に制限します。
    if (!name || name.length > 120) {
        throw new Error('ブランチ名が不正です');
    }
    if (name.startsWith('-') || name.startsWith(':')) {
        throw new Error('ブランチ名の先頭に - や : は使えません');
    }
    if (/\s/.test(name)) {
        throw new Error('ブランチ名に空白は使えません');
    }
    if (!/^[A-Za-z0-9._/-]+$/.test(name)) {
        throw new Error('ブランチ名に使用できない文字が含まれています');
    }
    if (name.includes('..') || name.includes('//') || name.endsWith('/') || name.endsWith('.')) {
        throw new Error('ブランチ名形式が不正です');
    }
}

function validateFilePath(filePath: string): void {
    // `git add -- <path>` に渡すパスとして危険な制御文字やオプション風の値を拒否します。
    if (!filePath) {
        throw new Error('ファイルパスが空です');
    }
    if (filePath.startsWith('-')) {
        throw new Error('ファイルパスの先頭に - は使えません');
    }
    if (/[\r\n\0]/.test(filePath)) {
        throw new Error('ファイルパスに不正な制御文字が含まれています');
    }
}

function writeTempFile(content: string, prefix: string): string {
    // commit message をコマンドライン引数で直接渡さず、一時ファイル経由にします。
    // 改行を含むメッセージでも安全に扱いやすくなります。
    // existsSync(WORKSPACE_ROOT) はワークスペースディレクトリが存在するか同期的に確認します。
    // Python の os.path.exists(WORKSPACE_ROOT) や Path(WORKSPACE_ROOT).exists() に相当します。
    // ! で反転しているため「存在しない場合」にブロックの中へ入ります。
    // 存在しない場合は mkdirSync で作成します。{ recursive: true } は途中の親ディレクトリも
    // まとめて作る指定で、Python の Path(...).mkdir(parents=True, exist_ok=True) に近いです。
    if (!existsSync(WORKSPACE_ROOT)) {
        mkdirSync(WORKSPACE_ROOT, { recursive: true });
    }
    const tempPath = join(WORKSPACE_ROOT, `.${prefix}-${Date.now()}.txt`);
    writeFileSync(tempPath, content, 'utf-8');
    return tempPath;
}

export const createBranch = {
    name: 'createBranch',
    description: '新しい Git ブランチを作成する。既存ブランチがある場合は現在HEADへ強制リセットする。',
    needsApproval: true,
    parameters: {
        type: 'object',
        properties: {
            branchName: {
                type: 'string',
                description: "作成するブランチ名（例: 'fix/error-handling'）"
            }
        },
        required: ['branchName']
    },
    // execute: async (args: { branchName: string }) => { ... } について
    // execute はツール実行時に Agent から呼ばれる非同期関数をプロパティとして持ちます。
    // Python でいう「辞書に関数オブジェクトを値として入れておく」設計に近いです。
    // async は非同期関数の宣言で、Python の async def に対応します。
    // args: { branchName: string } は引数の型注釈で、
    //   Python の def execute(args: dict) や TypedDict に近く、
    //   args.branchName が string 型であることをコンパイラに伝えます。
    // validateBranchName(branchName) は入力値の安全性を確認する関数を呼び出しています。
    //   問題があれば throw でエラーを投げ、問題なければ何も返さず（void）次の処理へ進みます。
    execute: async (args: { branchName: string }) => {
        const branchName = args.branchName;
        validateBranchName(branchName);

        try {
            const result = await execCommand.execute({
                commandName: 'git',
                commandArgs: ['checkout', '-B', branchName]
            });
            return `ブランチを作成しました: ${branchName}\n${result}`;
        } catch (error) {
            throw new Error(`ブランチ作成失敗: ${error}`);
        }
    }
};

export const commitChanges = {
    name: 'commitChanges',
    description: 'メッセージ付きで変更をコミットする。変更がない場合はコミットしない。',
    needsApproval: true,
    parameters: {
        type: 'object',
        properties: {
            message: {
                type: 'string',
                description: 'コミットメッセージ'
            },
            files: {
                type: 'array',
                items: {
                    type: 'string'
                },
                description: 'コミットするファイルのパスのリスト'
            }
        },
        required: ['message', 'files']
    },
    execute: async (args: { message: string; files: string[] }) => {
        // execute に async アロー関数を直接渡しています。
        // Pythonでいう「関数オブジェクトを辞書に入れておく」設計に近いです。
        if (!args.message || /[\0]/.test(args.message)) {
            throw new Error('コミットメッセージが不正です');
        }

        try {
            // `git status --porcelain` を実行し、コミット前に変更があるかを確認します。
            // --porcelain は人間向けの装飾を省いたスクリプト向け出力形式を指定するオプションです。
            // 変更ファイルがあれば " M src/foo.ts" のような行が返り、なければ空文字が返ります。
            // Python の subprocess.run(['git', 'status', '--porcelain'], capture_output=True) に近い処理です。
            // await は非同期処理の完了を待つキーワードで、Python の await asyncio.coroutine() に対応します。
            // execCommand.execute はコマンドを実行して stdout 文字列を返す Promise を返します。
            const status = await execCommand.execute({
                commandName: 'git',
                commandArgs: ['status', '--porcelain']
            });

            if (!status.trim()) {
                return 'コミットする変更がありません（既に最新の状態です）';
            }

            for (const file of args.files) {
                // `git add -- file` の `--` は、以降をオプションではなくパスとして扱わせる区切りです。
                validateFilePath(file);
                await execCommand.execute({
                    commandName: 'git',
                    commandArgs: ['add', '--', file]
                });
            }

            const messageFile = writeTempFile(args.message, 'commit-message');
            try {
                const result = await execCommand.execute({
                    commandName: 'git',
                    commandArgs: ['commit', '-F', messageFile]
                });
                return `コミットしました: ${args.message}\n${result}`;
            } finally {
                try { unlinkSync(messageFile); } catch { /* ignore */ }
            }
        } catch (error) {
            throw new Error(`コミット失敗: ${error}`);
        }
    }
};

export const pushBranch = {
    name: 'pushBranch',
    description: '現在のブランチをリモートリポジトリにプッシュする。新規ブランチの場合は上流を設定する。',
    needsApproval: true,
    parameters: {
        type: 'object',
        properties: {
            branchName: {
                type: 'string',
                description: 'プッシュするブランチ名'
            }
        },
        required: ['branchName']
    },
    execute: async (args: { branchName: string }) => {
        validateBranchName(args.branchName);
        try {
            const result = await execCommand.execute({
                commandName: 'git',
                commandArgs: ['push', '-u', 'origin', args.branchName]
            });
            return `ブランチをプッシュしました: ${args.branchName}\n${result}`;
        } catch (error) {
            throw new Error(`プッシュ失敗: ${error}`);
        }
    }
};
