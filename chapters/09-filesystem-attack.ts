import * as fs from 'fs/promises';
import * as path from 'path';
import { isSensitiveFile, isDangerousCommand } from '../src/core/security';

// シナリオを実行し、成功/失敗を報告するシンプルなランナー
// title は表示用のシナリオ名、fn は実際に検証する処理です。
async function runScenario(
    title: string,
    fn: () => Promise<void>
): Promise<void> {
    // process.stdout.write は改行せずに文字を出力します。
    // このあと OK または BLOCKED を同じ行に出したいため使っています。
    process.stdout.write(`- ${title} ... `);
    try {
        // fn() の中でエラーが投げられなければ、そのシナリオは通過扱いです。
        await fn();
        console.log('OK');
    } catch (error: any) {
        // セキュリティ検出を「エラーを投げる」ことで表現しているため、
        // catch に来た場合は BLOCKED と表示します。
        console.log(`BLOCKED (${error.message})`);
    }
}

// 機密ファイル名と危険なコマンドが検出されるかを確認するデモです。
async function main() {
    // workspaceRoot は、このプロジェクト内の workspace ディレクトリの絶対パスです。
    const workspaceRoot = path.resolve(process.cwd(), 'workspace');

    // workspace がなければ作成します。すでにあっても recursive: true なのでエラーになりません。
    await fs.mkdir(workspaceRoot, { recursive: true });

    console.log('=== シナリオ1: ファイルシステムへの攻撃デモ ===\n');

    await runScenario('機密ファイル検出: .env ファイル', async () => {
        // .env はAPIキーなどの秘密情報を置くことが多いため、機密ファイルとして扱います。
        const target = '.env';
        if (isSensitiveFile(target)) {
            // 検出された場合は Error を投げ、runScenario 側で BLOCKED と表示します。
            throw new Error('機密ファイルとして検出されました');
        }
    });

    await runScenario('機密ファイル検出: credentials.json', async () => {
        // credentials.json も認証情報が入ることが多いファイル名です。
        const target = 'credentials.json';
        if (isSensitiveFile(target)) {
            throw new Error('機密ファイルとして検出されました');
        }
    });

    console.log('\n=== シナリオ2: 危険なコマンドの検出 ===\n');

    await runScenario('sudoコマンドの検出', async () => {
        // sudo を含むコマンドは権限昇格につながるため危険と判定される想定です。
        const result = isDangerousCommand('sudo rm -rf /');
        if (result.dangerous) {
            throw new Error(result.reason || '危険なコマンド');
        }
    });

    await runScenario('コマンド置換の検出', async () => {
        // $(...) はコマンド置換です。
        // 入力文字列の中で別コマンドを実行できるため、攻撃に使われることがあります。
        const result = isDangerousCommand('echo $(cat /etc/passwd)');
        if (result.dangerous) {
            throw new Error(result.reason || '危険なコマンド');
        }
    });

    await runScenario('安全なコマンドの許可', async () => {
        // ls -la は単純な一覧表示なので、安全なコマンドとして許可される想定です。
        const result = isDangerousCommand('ls -la');
        if (result.dangerous) {
            throw new Error(result.reason || '危険なコマンド');
        }
        console.log('(安全なコマンドとして認識)');
    });

    console.log('\n完了: すべての攻撃シナリオを実行しました。');
}

// main を実行します。
// 予期しないエラーが起きた場合は内容を表示し、終了コード1で失敗を表します。
main().catch((error) => {
    console.error('デモ実行中にエラーが発生しました:', error);
    process.exit(1);
});
