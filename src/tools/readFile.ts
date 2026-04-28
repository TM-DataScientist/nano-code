import * as fs from 'fs/promises';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(process.cwd(), './workspace');
const MAX_FILE_SIZE = 100 * 1024; // 100KB

// LLMから渡された引数を受け取り、workspace 配下のファイルだけを読み込む実行関数です。
// args の型 `{ path: string }` は「path という文字列プロパティを持つオブジェクト」を意味します。
async function readFileExecute(args: { path: string }): Promise<string> {
    const absolutePath = path.resolve(WORKSPACE_ROOT, args.path);

    // パストラバーサルとは、`../` などを使って本来許可されたディレクトリの外へ移動し、
    // `.env` やシステム設定ファイルのような読んではいけないファイルへアクセスしようとする攻撃です。
    // 例: `../../.env` のような入力をそのまま読むと、workspace 外の機密ファイルに届く可能性があります。
    // そのため path.resolve 後に prefix を確認し、workspace 外へ出るパストラバーサルを防ぎます。
    const allowedPrefix = WORKSPACE_ROOT + path.sep;
    if (!absolutePath.startsWith(allowedPrefix) && absolutePath !== WORKSPACE_ROOT) {
        throw new Error(`アクセス拒否: ${args.path} はワークスペース外です`);
    }

    // シンボリックリンクとは、別のファイルやディレクトリを指す「ショートカット」のようなファイルです。
    // たとえば workspace 内にある `secret-link` が、実際には workspace 外の `/etc/passwd` を指している場合があります。
    // 見かけ上のパスだけを確認すると workspace 内に見えるため、fs.realpath でリンク先の実パスを確認します。
    // その実パスも workspace 内にある場合だけ読み込みを許可します。
    const realPath = await fs.realpath(absolutePath);
    if (!realPath.startsWith(allowedPrefix) && realPath !== WORKSPACE_ROOT) {
        throw new Error(`アクセス拒否: ${args.path} はシンボリックリンク経由でワークスペース外を参照しています`);
    }

    try {
        const stat = await fs.stat(absolutePath);
        // ファイル種別チェック
        if (!stat.isFile()) {
            throw new Error(`通常ファイルではありません: ${args.path}`);
        }
        if (stat.size > MAX_FILE_SIZE) {
            throw new Error(
                `ファイルが大きすぎます: ${args.path} (${Math.round(stat.size / 1024)}KB)。` +
                `100KB以下のファイルのみ読み込めます。`
            );
        }

        return await fs.readFile(absolutePath, 'utf-8');
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            throw new Error(`ファイルが見つかりません: ${args.path}`);
        }
        throw error;
    }
}

export const readFile = {
    // このオブジェクト全体が Tool 定義です。LLMには name/description/parameters が渡り、
    // 実際の実行時には execute 関数が呼ばれます。
    name: 'readFile',
    description:
        'ワークスペース内の指定されたパスのファイル内容を文字列として読み込む。ファイルが存在しない場合はエラーを返す。100KBを超える巨大ファイルは読み込めない（コンテキストウィンドウ保護のため）。相対パスまたは絶対パスを指定できる。',
    needsApproval: false,
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: "読み込むファイルのパス（例: 'README.md', 'src/index.ts'）",
            },
        },
        required: ['path'],
    },
    execute: readFileExecute,
};
