import { readFile } from '../src/tools/readFile';
import { writeFile } from '../src/tools/writeFile';
import { execCommand } from '../src/tools/execCommand';
import * as path from 'path';
import * as fs from 'fs/promises';

// ツールの基本動作とセキュリティチェックを順番に試すデモです。
async function main() {
    console.log('--- Starting Tools Demo ---\n');

    // ワークスペースディレクトリが存在することを確認
    // process.cwd() は、いまコマンドを実行しているディレクトリを返します。
    // path.resolve は、相対パスを絶対パスへ変換します。
    const workspaceDir = path.resolve(process.cwd(), 'workspace');

    // recursive: true を付けると、すでに存在していてもエラーにせず、
    // 必要な親ディレクトリもまとめて作成できます。
    await fs.mkdir(workspaceDir, { recursive: true });

    // 1. Test writeFile
    console.log('1. Testing writeFile...');
    try {
        // writeFile.execute は、workspace 配下にファイルを書き込むツールです。
        // path は workspace から見た相対パスとして扱われます。
        const result = await writeFile.execute({
            path: 'hello.txt',
            content: 'Hello from NanoCode Tools!'
        });
        console.log('✅ writeFile success:', result);
    } catch (error: any) {
        // error: any は、TypeScript に「ここでは error の型を細かく決めない」と伝えています。
        // そのため error.message のようなプロパティへアクセスできます。
        console.error('❌ writeFile failed:', error.message);
    }

    // 2. Test readFile
    console.log('\n2. Testing readFile...');
    try {
        // 直前に作成した hello.txt を読み込みます。
        // await により、読み込み完了後に content へ文字列が入ります。
        const content = await readFile.execute({ path: 'hello.txt' });
        console.log('✅ readFile success:', content);
    } catch (error: any) {
        console.error('❌ readFile failed:', error.message);
    }

    // 3. Test execCommand (ls)
    console.log('\n3. Testing execCommand (ls)...');
    try {
        // execCommand.execute は許可されたコマンドを実行するツールです。
        // ここではファイル一覧を見る ls -l を実行しています。
        const output = await execCommand.execute({ command: 'ls -l' });
        console.log('✅ execCommand success:\n', output);
    } catch (error: any) {
        console.error('❌ execCommand failed:', error.message);
    }

    // 4. Test Security (Path Traversal)
    console.log('\n4. Testing Security (Path Traversal)...');
    try {
        // ../package.json は workspace の外側を指そうとするパスです。
        // ツールが安全に作られていれば、この読み込みは拒否されます。
        await readFile.execute({ path: '../package.json' });
        console.error('❌ Security check failed: Should not be able to read outside workspace');
    } catch (error: any) {
        // ここで catch されることが期待される動作です。
        console.log('✅ Security check passed:', error.message);
    }

    // 5. Test Security (Command Injection)
    console.log('\n5. Testing Security (Command Injection)...');
    try {
        // セミコロンで複数コマンドをつなぐ文字列は、コマンドインジェクションの典型例です。
        // 安全な execCommand であれば、このような入力は拒否されます。
        await execCommand.execute({ command: 'ls; rm -rf /' });
        console.error('❌ Security check failed: Should not execute injected command');
    } catch (error: any) {
        console.log('✅ Security check passed:', error.message);
    }

    console.log('\n--- Tools Demo Completed ---');
}

main().catch(console.error);
