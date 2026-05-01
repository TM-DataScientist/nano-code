// src/tools/execCommandSandbox.ts
import { spawn } from 'child_process';
import * as path from 'path';
import type { Tool } from '../types';
import { Sandbox } from '../core/sandbox';
import { config } from '../config';
import { parseCommand } from './execCommand';

const WORKSPACE_ROOT = path.resolve(process.cwd(), './workspace');
const ALLOWED_COMMANDS = ['bun', 'ls', 'git', 'gh'];
const MAX_OUTPUT_LENGTH = 2000;

// 環境変数はホワイトリスト方式（機密情報の漏洩防止）
const SAFE_ENV = {
    // APIキーなどをサブプロセスへ渡さないため、必要最小限だけ明示します。
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: '/tmp',
    LANG: process.env.LANG || 'C.UTF-8',
};
type ExecCommandInput = {
    command?: unknown;
    commandName?: unknown;
    commandArgs?: unknown;
};

// args: Record<string, unknown> について:
//   Record<K, V> は「キーの型が K、値の型が V のオブジェクト（辞書）」を表す組み込みユーティリティ型です。
//   Python の dict[str, Any] に相当しますが、V に unknown を使うことで any より安全になります。
//
//   unknown vs any の違い:
//     any     : 型チェックを完全に無効化。どんな操作もエラーにならない（危険）。
//               Python の Any と同じ感覚で使えるが、TypeScript の恩恵が得られない。
//     unknown : 「型が不明」という状態。使う前に typeof や instanceof で型を確認しないと
//               コンパイルエラーになる（安全）。
//               Python の object 型（すべての型の基底クラス）に近い概念です。
//
//   なぜ Record<string, unknown> を使うか:
//     Agent からツールに渡される引数の形は実行時まで決まらないため、
//     汎用的に受け取れる Record<string, unknown> で受け取ります。
//     その後 35行目の typeof input.command === 'string' のように
//     型を確認してから安全に使う設計になっています。
async function execCommandSandboxExecute(
    args: Record<string, unknown>
): Promise<string> {
    // 通常版 execCommand と同じ入力検証を行ったうえで、設定により Sandbox 経由で実行します。
    const input = args as ExecCommandInput;
    let commandName = '';
    let commandArgs: string[] = [];
    let commandForCheck = '';

    if (typeof input.command === 'string') {
        const command = input.command;
        // /[;&`$]/ は正規表現リテラルです。Python の re.compile(r'[;&`$]') に相当します。
        // TypeScript/JavaScript では / と / で囲むだけで正規表現オブジェクトになります。
        // Python の re.compile(...) や re.search(...) のようにインポートは不要です。
        //
        // [;&`$] は文字クラスで「; か & か ` か $ のいずれか1文字」にマッチします。
        // Python の re.compile(r'[;&`$]') と同じ意味です。
        // これらはシェルで特別な意味を持つ「メタ文字」です：
        //   ;  : コマンドの区切り（例: rm -rf / ; echo done）
        //   &  : バックグラウンド実行（例: malicious_cmd &）
        //   `  : コマンド置換（例: `rm -rf /`）
        //   $  : 変数展開（例: $HOME や $(rm -rf /)）
        //
        // .test(command) は文字列が正規表現にマッチするか boolean で返します。
        // Python の bool(re.search(pattern, command)) に相当します。
        // マッチした（危険文字が含まれる）場合は throw でエラーにしてコマンド実行を拒否します。
        const dangerousChars = /[;&`$]/;
        if (dangerousChars.test(command)) {
            throw new Error('シェルメタ文字を含むコマンドは実行できません');
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

    // サンドボックス分岐
    if (process.platform === 'linux' && config.sandbox) {
        // WindowsやmacOSでは bubblewrap が使えないため、Linuxかつ config.sandbox=true のときだけ有効化します。
        const sandbox = new Sandbox();
        const result = await sandbox.run(commandName, commandArgs, {
            allowNetwork: false,
            env: SAFE_ENV,
        });

        if (result.exitCode !== 0) {
            throw new Error(`Command failed: ${result.stderr}`);
        }
        return result.stdout;
    }

    // 通常実行（第4章と同じ）
    return new Promise((resolve, reject) => {
        // サンドボックス無効時も shell:false と許可リストで最低限の安全策を維持します。
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

export const execCommandSandbox: Tool = {
    name: 'execCommand',
    description: 'ワークスペース内で許可されたコマンドを実行',
    needsApproval: true,
    parameters: {
        type: 'object',
        properties: {
            command: { type: 'string', description: '実行するコマンド' },
        },
        required: ['command'],
    },
    execute: execCommandSandboxExecute,
};
