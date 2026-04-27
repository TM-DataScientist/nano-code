import * as readline from 'readline';

// CLI上でユーザーに y/n を尋ねる関数です。
// Promise<boolean> を返すので、呼び出し側は `await requestApproval(...)` と書けます。
export async function requestApproval(
    toolName: string,
    args: any
): Promise<boolean> {
    // readline の question はコールバック方式のAPIです。
    // ここでは new Promise で包み、async/await で扱いやすい形に変換しています。
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('\n--- 承認が必要です ---');
        console.log(`ツール: ${toolName}`);
        console.log(`引数: ${JSON.stringify(args, null, 2)}`);

        rl.question('このツールを実行しますか？ (y/n): ', (answer) => {
            rl.close();

            // resolve(true/false) を呼ぶと Promise が完了し、await している側へ結果が返ります。
            if (answer.toLowerCase() === 'y') {
                console.log('承認されました。実行します...\n');
                resolve(true);
            } else {
                console.log('キャンセルされました。\n');
                resolve(false);
            }
        });
    });
}
