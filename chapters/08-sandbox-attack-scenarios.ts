/**
 * 第8章: サンドボックス攻撃シナリオ
 *
 * これらのテストは、サンドボックスが悪意ある操作を正しくブロックすることを検証します。
 * Dockerコンテナ内で以下のように実行してください:
 *
 * docker run -it --rm \
 *   --cap-add=SYS_ADMIN \
 *   --security-opt seccomp=unconfined \
 *   -v "$(pwd):/workspace" \
 *   -w /workspace \
 *   nano-code \
 *   bash
 *
 * 実行: bun run chapters/08-sandbox-attack-scenarios.ts
 */

import { Sandbox } from '../src/core/sandbox';

// サンドボックスが危険な操作を止め、許可された操作は通すかを確認する関数です。
async function runScenarios() {
  // Sandbox はコマンドを隔離環境で実行するためのクラスです。
  // ホスト環境への影響を抑えながら、コマンドの成功/失敗を確認します。
  const sandbox = new Sandbox();

  console.log('='.repeat(60));
  console.log('サンドボックス攻撃シナリオテスト');
  console.log('='.repeat(60));
  console.log();

  // シナリオ1: ファイルシステム攻撃
  console.log('--- シナリオ1: ファイルシステム攻撃 ---');
  console.log('/etc への書き込みを試行中（失敗するはず）...');

  // /etc はシステム設定が置かれる重要なディレクトリです。
  // サンドボックス内からここへファイル作成できないことを確認します。
  const fsResult = await sandbox.run('touch', ['/etc/malicious-file']);

  // exitCode が 0 なら成功、0以外なら失敗を表します。
  // このシナリオでは失敗することが正しい結果です。
  console.log(`Exit code: ${fsResult.exitCode}`);
  console.log(`stderr: ${fsResult.stderr.trim()}`);
  console.log(`Result: ${fsResult.exitCode !== 0 ? '✓ BLOCKED' : '✗ VULNERABILITY!'}`);
  console.log();

  // シナリオ2: ネットワーク攻撃
  console.log('--- シナリオ2: ネットワーク攻撃 ---');
  console.log('外部サーバーへの接続を試行中（失敗するはず）...');

  // allowNetwork: false を指定し、外部ネットワークへ接続できないことを確認します。
  const netResult = await sandbox.run('curl', ['-s', '--connect-timeout', '3', 'https://example.com'], {
    allowNetwork: false,
  });

  console.log(`Exit code: ${netResult.exitCode}`);
  console.log(`stderr: ${netResult.stderr.trim()}`);
  console.log(`Result: ${netResult.exitCode !== 0 ? '✓ BLOCKED' : '✗ VULNERABILITY!'}`);
  console.log();

  // シナリオ3: 破壊的コマンド
  console.log('--- シナリオ3: 破壊的コマンド ---');
  console.log('/bin の削除を試行中（失敗するはず）...');

  // /bin には基本コマンドが置かれています。
  // rm -rf /bin のような破壊的操作が失敗することを確認します。
  const rmResult = await sandbox.run('rm', ['-rf', '/bin']);

  console.log(`Exit code: ${rmResult.exitCode}`);
  console.log(`stderr: ${rmResult.stderr.trim()}`);
  console.log(`Result: ${rmResult.exitCode !== 0 ? '✓ BLOCKED' : '✗ VULNERABILITY!'}`);
  console.log();

  // シナリオ4: 許可された操作（成功するはず）
  console.log('--- シナリオ4: 許可された操作 ---');
  console.log('サンドボックス内で許可されたコマンドを実行中...');

  // echo は安全なコマンドなので、サンドボックス内で成功することを期待します。
  const allowedResult = await sandbox.run('echo', ['Hello from sandbox!']);

  console.log(`Exit code: ${allowedResult.exitCode}`);
  console.log(`stdout: ${allowedResult.stdout.trim()}`);
  console.log(`Result: ${allowedResult.exitCode === 0 ? '✓ ALLOWED' : '✗ UNEXPECTED BLOCK'}`);
  console.log();

  // シナリオ5: /tmp への書き込み（成功するはず）
  console.log('--- シナリオ5: /tmp への書き込み ---');
  console.log('/tmp への書き込みを試行中（成功するはず）...');

  // /tmp は一時ファイル用の場所です。
  // サンドボックス内で一時ファイルを書き込み、読み戻せることを確認します。
  const tmpResult = await sandbox.run('/bin/sh', ['-c', 'echo "test" > /tmp/sandbox-test.txt && cat /tmp/sandbox-test.txt']);

  console.log(`Exit code: ${tmpResult.exitCode}`);
  console.log(`stdout: ${tmpResult.stdout.trim()}`);
  console.log(`Result: ${tmpResult.exitCode === 0 ? '✓ ALLOWED' : '✗ UNEXPECTED BLOCK'}`);
  console.log();

  // サマリー
  console.log('='.repeat(60));
  console.log('サマリー');
  console.log('='.repeat(60));

  // 各シナリオの実際の結果と、期待する結果を一覧にまとめます。
  const results = [
    { name: 'Filesystem write to /etc', blocked: fsResult.exitCode !== 0, shouldBlock: true },
    { name: 'Network access', blocked: netResult.exitCode !== 0, shouldBlock: true },
    { name: 'Destructive command (rm /bin)', blocked: rmResult.exitCode !== 0, shouldBlock: true },
    { name: 'Allowed operation (echo)', blocked: allowedResult.exitCode !== 0, shouldBlock: false },
    { name: 'Write to /tmp', blocked: tmpResult.exitCode !== 0, shouldBlock: false },
  ];

  let allPassed = true;
  // for...of は配列の要素を1つずつ取り出して処理する構文です。
  for (const r of results) {
    // blocked と shouldBlock が一致していれば、そのシナリオは成功です。
    const passed = r.blocked === r.shouldBlock;
    if (!passed) allPassed = false;
    const status = passed ? '✓' : '✗';
    console.log(`${status} ${r.name}: ${r.blocked ? 'Blocked' : 'Allowed'} (expected: ${r.shouldBlock ? 'Block' : 'Allow'})`);
  }

  console.log();
  console.log(allPassed ? '✓ すべてのテストが成功しました!' : '✗ 一部のテストが失敗しました!');
}

// runScenarios を実行し、予期しないエラーが起きたら表示します。
runScenarios().catch(console.error);
