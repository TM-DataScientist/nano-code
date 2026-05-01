// src/core/sandbox.ts
import { spawn } from 'child_process';

// SandboxOptions は、サンドボックス内でコマンドを動かすときの任意設定です。
// `cwd?: string` の `?` は「指定してもしなくてもよい」ことを表します。
//
// export interface SandboxOptions について:
//   interface はオブジェクトの「型の設計図」を定義するキーワードです。
//   Python の TypedDict や dataclass に近い概念です。
//   export を付けることで他ファイルから import して使えるようになります。
//
//   各プロパティの ? は「省略可能（Optional）」を意味します。
//   Python の型ヒントで Optional[str] や str | None と書くのに相当します。
//     cwd?: string         → 省略可能な文字列。省略時は undefined になります。
//                            Python の def run(cwd: str | None = None): に近い。
//     allowNetwork?: boolean → 省略可能な真偽値（true/false）。
//                              Python の bool | None に相当します。
//     env?: Record<string, string> → 省略可能な「キーも値も string の辞書」。
//                                    Python の dict[str, str] | None に相当します。
//
//   interface は実行時には存在しません（TypeScript のコンパイル時のみ使われる型情報です）。
//   Python の TypedDict と同様に、実際のオブジェクトの形を制約するための宣言です。
export interface SandboxOptions {
  cwd?: string;                 // 作業ディレクトリ
  allowNetwork?: boolean;       // ネットワークアクセスの許可
  env?: Record<string, string>; // 環境変数
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class Sandbox {
  // run は外部コマンドを bubblewrap(bwrap) 経由で起動し、標準出力・標準エラー・終了コードを返します。
  // Python の subprocess.run(..., capture_output=True) に近い役割です。
  async run(
    command: string,
    args: string[],
    options: SandboxOptions = {}
  ): Promise<SandboxResult> {
    const cwd = options.cwd || process.cwd();

    // bwrapの引数を構築
    const bwrapArgs: string[] = [
      // 1. ファイルシステムの隔離
      // ルートを読み取り専用でバインド（システム破壊の防止）
      '--ro-bind', '/', '/',

      // デバイスファイルと一時ディレクトリを新規作成
      '--dev', '/dev',
      '--tmpfs', '/tmp',

      // 作業ディレクトリのみ書き込み許可でバインド
      '--bind', cwd, cwd,
      '--chdir', cwd,

      // 親プロセス(Node)が終了したらサンドボックスも終了（ゾンビ防止）
      '--die-with-parent',

      // 環境変数をクリア
      '--clearenv',
    ];

    // 環境変数の再設定（PATHなどを引き継ぐ）
    const envVars = {
      // `...options.env` は辞書の展開です。後ろに書いた値が前の値を上書きします。
      // Python の `{**base_env, **options_env}` と同じ発想です。
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      HOME: '/tmp',
      ...options.env,
    };
    // for (const [key, value] of Object.entries(envVars)) について:
    //   Object.entries(obj) はオブジェクト（辞書）の [キー, 値] ペアの配列を返します。
    //   Python の dict.items() に対応します。
    //     例: Object.entries({ PATH: '/bin', HOME: '/tmp' })
    //         → [['PATH', '/bin'], ['HOME', '/tmp']]
    //
    //   for (const [key, value] of ...) は分割代入（Destructuring）を使ったループです。
    //   配列の各要素 ['PATH', '/bin'] を [key, value] に分解しながら受け取ります。
    //   Python の for key, value in env_vars.items(): に相当します。
    //
    //   const はループ内で key / value を再代入しない宣言です。Python に同じ制約はありません。
    for (const [key, value] of Object.entries(envVars)) {
      if (value !== undefined) {
        bwrapArgs.push('--setenv', key, value);
      }
    }

    // 2. ネットワーク制御
    if (!options.allowNetwork) {
      bwrapArgs.push('--unshare-net'); // ネットワーク名前空間を分離（通信遮断）
    }

    // 実行するコマンド
    bwrapArgs.push('--', command, ...args);

    // プロセス生成と結果取得
    // return new Promise((resolve) => { ... }) について:
    //   Promise はコールバックAPI（spawn のようなイベント駆動の非同期処理）を
    //   await で待てる形に変換するためのラッパーです。
    //   Python の asyncio.Future や loop.run_in_executor() に近い概念です。
    //
    //   new Promise((resolve) => { ... }) の構造:
    //     - resolve は「処理が完了したときに結果を渡す関数」です。
    //       Python の future.set_result(value) に相当します。
    //     - resolve(値) を呼ぶと、この Promise が「完了」状態になり、
    //       await した呼び出し元に値が返ります。
    //     - reject（今回は省略）を呼ぶとエラーとして伝搬します。
    //
    //   なぜ new Promise が必要か:
    //     spawn はコールバック（.on('close', ...)）ベースのAPIで、
    //     async/await では直接 await できません。
    //     new Promise で包むことで spawn の完了を await できるようになります。
    //
    //   Python で書くなら asyncio.Future を使う場合に相当:
    //     loop = asyncio.get_event_loop()
    //     future = loop.create_future()
    //     # コールバック内で future.set_result(value) を呼ぶ
    //     result = await future
    return new Promise((resolve) => {
      // spawn はプロセスを開始し、stdout/stderr の data イベントで出力を少しずつ受け取ります。
      const child = spawn('bwrap', bwrapArgs, {
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      // child.stdout.on('data', d => stdout += d.toString()) について:
      // child.stdout はプロセスの標準出力を表すストリーム（データの流れ）です。
      // Python の proc.stdout に相当します。
      //
      // .on('data', コールバック) はイベントリスナーの登録です。
      // 'data' イベントはプロセスが出力を書き出すたびに発火します。
      // Python の proc.stdout.read() と違い、データが届くたびにチャンク（断片）で受け取ります。
      //
      // d => stdout += d.toString() はアロー関数（コールバック）です。
      //   d        : 受け取ったチャンク（Buffer 型。Python の bytes に相当）
      //   .toString(): Buffer を文字列に変換。Python の .decode() に相当
      //   stdout +=: 受け取るたびに文字列に追記。Python の stdout += d.decode() と同じ
      //
      // まとめると「標準出力のデータが届くたびに文字列として stdout に追記する」処理です。
      // Python の subprocess.run(..., capture_output=True).stdout.decode() を
      // ストリーミング（逐次受信）で実装したものに相当します。
      child.stdout.on('data', d => stdout += d.toString());
      child.stderr.on('data', d => stderr += d.toString());

      // child.on('close', (code) => { resolve({...}) }) について:
      // 'close' イベントはプロセスが終了したときに発火します。
      // Python の proc.wait() が完了した瞬間に相当します。
      //
      // (code) はプロセスの終了コードです。
      //   0      : 正常終了（Python の returncode == 0 と同じ）
      //   1以上  : エラー終了
      //   null   : シグナルで強制終了された場合（SIGKILL など）
      //   Python の proc.returncode に相当しますが、null になり得る点が異なります。
      //
      // resolve({...}) で Promise を完了させ、await した呼び出し元に結果を返します。
      //
      // { stdout, stderr, exitCode: code ?? -1 } について:
      //   { stdout, stderr } は { stdout: stdout, stderr: stderr } の省略記法です。
      //   Python の {"stdout": stdout, "stderr": stderr} に相当します。
      //   exitCode: code ?? -1 の ?? は「Null 合体演算子」です。
      //     code が null または undefined のとき -1 を使います。
      //     Python の code if code is not None else -1 に相当します。
      //     シグナル終了で code が null になる場合のフォールバックです。
      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1
        });
      });

      // bwrap自体の起動失敗をハンドリング
      child.on('error', (err) => {
        resolve({
          stdout: '',
          stderr: `Sandbox Error: ${err.message}\n` +
            '(Hint: docker run の --cap-add=SYS_ADMIN オプションを確認してください)',
          exitCode: 126
        });
      });
    });
  }
}
