import { spawn } from 'child_process';
import * as path from 'path';
import type { Tool } from '../types';

const WORKSPACE_ROOT = path.resolve(process.cwd(), './workspace');
const ALLOWED_COMMANDS = ['bun', 'ls', 'cat', 'grep', 'find', 'pwd', 'mkdir', 'git', 'gh'];
const MAX_OUTPUT_LENGTH = 2000;

// Quote は「現在どの引用符の中にいるか」を表す型です。
// `|` は union 型で、Python の Literal['"', "'"] | None に近く、ダブルクォート・シングルクォート・引用符なし(null)だけを許します。
type Quote = '"' | "'" | null;
type ExecCommandInput = {
    // unknown は「値は来るが、まだ型が分からない」ことを表します。
    // 実行前に typeof や Array.isArray で確認してから使います。
    command?: unknown;
    commandName?: unknown;
    commandArgs?: unknown;
};

// 引用符付き引数をサポートする最小限のコマンドパーサ
export function parseCommand(input: string): string[] {
    // shell: false で安全に spawn するため、1本の文字列をコマンド名と引数配列へ分解します。
    const tokens: string[] = [];
    let current = '';
    let quote: Quote = null;
    // let はあとから値を入れ替えられる変数宣言です。
    // escaped は「直前にバックスラッシュを読んだので、次の文字を特別扱いする」状態を覚える boolean フラグです。
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
        // noUncheckedIndexedAccess が有効なため input[i] の型は string | undefined になります。
        // ループ条件 i < input.length により実行時に undefined になることはなく、as string で型エラーを抑制します。
        // 実行時の ch は Python の s[i] と同様、必ず長さ 1 の文字列（1 UTF-16 コードユニット）です。
        const ch = input[i] as string;

        if (quote) {
            if (escaped) {
                current += ch;
                escaped = false;
                continue;
            }

            // '\\' は TypeScript/JavaScript でバックスラッシュ 1 文字を表すエスケープシーケンスです。
            // Python の '\\' と同じく '\\'.length === 1 なので、ch（1 文字）がバックスラッシュのとき真になります。
            // この条件は「ダブルクォート内でバックスラッシュが来た → 次の文字をエスケープ」という意味です。
            // 例: echo "test\"end" をパース中、" の直前の \ でこの条件が真になります。
            if (ch === '\\' && quote === '"') {
                escaped = true;
                continue;
            }

            if (ch === quote) {
                quote = null;
                continue;
            }

            current += ch;
            continue;
        }

        // 引用符のエスケープ以外ではバックスラッシュを保持（Windowsパス対応）
        if (ch === '\\') {
            const nextCh = input[i + 1];
            if (nextCh === '"' || nextCh === "'") {
                current += nextCh;
                i++;
                continue;
            }
            current += ch;
            continue;
        }

        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }

        if (/\s/.test(ch)) {
            if (current.length > 0) {
                // tokens.push(current) は、いま作っている1つの引数 current を tokens 配列の末尾に追加します。
                // Python でいう tokens.append(current) に近い処理です。
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += ch;
    }

    if (quote) {
        throw new Error(`閉じられていない引用符: ${quote}`);
    }

    if (current.length > 0) {
        tokens.push(current);
    }

    return tokens;
}

async function execCommandExecute(args: Record<string, unknown>): Promise<string> {
    // LLMからの入力は信用せず、まず期待する形かどうかを確認します。
    // `as ExecCommandInput` は型アサーションで、Pythonのキャストのように値を変換する処理ではありません。
    // TypeScriptに「この後は command / commandName / commandArgs を持つかもしれない入力として扱う」と伝えています。
    const input = args as ExecCommandInput;
    let commandName = '';
    let commandArgs: string[] = [];
    let commandForCheck = '';

    // input.command は input オブジェクトの command プロパティを読む書き方です。
    // Python の辞書なら input["command"]、属性を持つオブジェクトなら input.command に近い参照です。
    // ここでは typeof で文字列か確認してから、コマンド文字列として扱います。
    if (typeof input.command === 'string') {
        const command = input.command;
        // ; や $ など、シェルで別コマンド実行につながる文字を拒否します。
        const dangerousChars = /[;&`$]/;
        // dangerousChars.test(command) は、command に危険文字が1つでも含まれるかを true/false で返します。
        // Python でいう re.search(pattern, command) is not None に近い判定です。
        if (dangerousChars.test(command)) {
            throw new Error('セキュリティ上の理由により、シェルメタ文字を含むコマンドは実行できません');
        }

        const parts = parseCommand(command);
        commandName = parts[0] || '';
        commandArgs = parts.slice(1);
        commandForCheck = command;
    } else if (typeof input.commandName === 'string') {
        commandName = input.commandName;
        if (Array.isArray(input.commandArgs)) {
            if (!input.commandArgs.every((arg) => typeof arg === 'string')) {
                throw new Error('commandArgs は文字列配列で指定してください');
            }
            commandArgs = input.commandArgs as string[];
        }
        commandForCheck = [commandName, ...commandArgs].join(' ');
    } else {
        throw new Error('command または commandName を指定してください');
    }

    if (!commandName) {
        throw new Error('コマンドが空です');
    }

    if (!ALLOWED_COMMANDS.includes(commandName)) {
        // 許可リスト方式にすることで、想定外のコマンド実行を防ぎます。
        throw new Error(`コマンド ${commandName} は許可されていません`);
    }

    const dangerousPatterns = [/rm\s+-rf/, />\s*\/dev/, /curl.*\|.*sh/, /wget.*\|.*sh/];
    for (const pattern of dangerousPatterns) {
        if (pattern.test(commandForCheck)) {
            throw new Error('危険なコマンドパターンが検出されました');
        }
    }

    for (const arg of commandArgs) {
        if (arg.startsWith('/') || arg.startsWith('.') || arg.includes('/') || arg.includes('\\')) {
            const resolvedPath = path.resolve(WORKSPACE_ROOT, arg);
            const allowedPrefix = WORKSPACE_ROOT + path.sep;
            if (!resolvedPath.startsWith(allowedPrefix) && resolvedPath !== WORKSPACE_ROOT) {
                throw new Error(`アクセス拒否: ${arg} はワークスペース外です`);
            }
        }
    }

    return new Promise((resolve, reject) => {
        // shell: false により、シェルを経由せず直接コマンドを起動します。
        // これにより `; rm -rf /` のようなシェル構文が解釈されにくくなります。
        const child = spawn(commandName, commandArgs, {
            cwd: WORKSPACE_ROOT,
            timeout: 30000,
            shell: false,
        });

        let stdout = '';
        let stderr = '';
        let stdoutTruncated = false;
        let stderrTruncated = false;

        child.stdout.on('data', (data: Buffer) => {
            if (stdout.length < MAX_OUTPUT_LENGTH) {
                stdout += data.toString();
                if (stdout.length >= MAX_OUTPUT_LENGTH) {
                    stdoutTruncated = true;
                }
            }
        });

        child.stderr.on('data', (data: Buffer) => {
            if (stderr.length < MAX_OUTPUT_LENGTH) {
                stderr += data.toString();
                if (stderr.length >= MAX_OUTPUT_LENGTH) {
                    stderrTruncated = true;
                }
            }
        });

        child.on('close', (code: number | null) => {
            if (stdoutTruncated) {
                stdout = stdout.slice(0, MAX_OUTPUT_LENGTH) + '\n... (出力が長いため省略されました)';
            }
            if (stderrTruncated) {
                stderr = stderr.slice(0, MAX_OUTPUT_LENGTH) + '\n... (出力が長いため省略されました)';
            }

            if (code === 0) {
                // stderrは必ずしもエラーではない（gitはブランチ切替等をstderrに出力する）
                resolve(stdout + (stderr ? `\n(stderr: ${stderr.trim()})` : ''));
            } else {
                reject(new Error(`コマンドが異常終了しました (exit code: ${code})\n${stderr}`));
            }
        });

        child.on('error', (error: Error) => {
            reject(new Error(`コマンド実行エラー: ${error.message}`));
        });
    });
}

export const execCommand: Tool = {
    name: 'execCommand',
    description:
        'ワークスペース内で許可された汎用コマンドを実行する。利用可能：bun、ls、cat、grep、find、pwd、mkdir、git、gh。',
    needsApproval: true,
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: "実行するコマンド（例: 'bun test', 'ls -la'）",
            },
        },
        required: ['command'],
    },
    execute: execCommandExecute,
};
