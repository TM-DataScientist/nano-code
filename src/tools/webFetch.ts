// src/tools/webFetch.ts
import type { Tool } from '../types';
import { config } from '../config';

// async function webFetchExecute(args: Record<string, unknown>): Promise<string> について
// async     : 非同期関数の宣言。Python の async def に対応します。
// args      : 引数名。
// Record<string, unknown>
//           : 「キーが string、値が unknown（型不明）の辞書」を表す型です。
//             Python の dict[str, Any] に近く、ツールの汎用インターフェースに合わせた型です。
//             unknown は any より厳しく、使う前に型チェックが必要です（8行目で as string しています）。
// Promise<string>
//           : この関数が非同期に string を返すことを示す戻り値の型です。
//             Python の async def f() -> str: に対応します。
//             await すると string が取り出せます。
async function webFetchExecute(args: Record<string, unknown>): Promise<string> {
    // Tool の execute は汎用的に Record<string, unknown> を受けるため、
    // ここで url を string として取り出しています。本番では typeof チェックを追加するとさらに安全です。
    //
    // typeof とは:
    //   typeof は値の型名を文字列で返す演算子です。
    //   Python の type(x).__name__ や isinstance(x, str) に近い役割を持ちます。
    //   例: typeof "hello"  → "string"
    //       typeof 42       → "number"
    //       typeof true     → "boolean"
    //       typeof {}       → "object"
    //       typeof undefined → "undefined"
    //
    //   型チェックの書き方:
    //     if (typeof args.url !== 'string') throw new Error('url は文字列である必要があります');
    //   Python で書くなら:
    //     if not isinstance(args["url"], str): raise TypeError("url must be str")
    //
    //   現在のコードは as string で型を強制しているだけなので、
    //   実行時に url が文字列でなくても TypeScript はエラーにしません。
    //   typeof で事前にチェックすると実行時エラーをより早く・明確に検出できます。
    //
    // const url = args.url as string; について:
    //   args.url は Record<string, unknown> から取り出した値なので型は unknown です。
    //   as string は「この値を string として扱え」と TypeScript コンパイラに伝える型アサーションです。
    //   Python にはない概念で、実行時の変換（キャスト）は行いません。あくまでコンパイラへの宣言です。
    //   Python の型ヒント str(x) とは異なり、実際の値の型は変わりません。
    //   つまり args.url が実際には数値でも、TypeScript はエラーを出さずに url: string として扱います。
    const url = args.url as string;

    // URLのパース（バリデーション含む）
    // let targetUrl: URL; について:
    //   let は再代入可能な変数宣言です（const は再代入不可）。Python の通常の変数代入に相当します。
    //   : URL は変数の型注釈で、Python の targetUrl: urllib.parse.ParseResult に近いです。
    //   try ブロックの外で宣言して内側で代入しているのは、後続コードでも targetUrl を参照するためです。
    //
    // new URL(url) について:
    //   URL は JavaScript/TypeScript の組み込みクラスで、URL 文字列を解析してオブジェクトに変換します。
    //   Python の urllib.parse.urlparse(url) や from urllib.parse import urlparse; urlparse(url) に相当します。
    //   new はクラスのインスタンスを生成するキーワードです。Python の URL(url)（コンストラクタ呼び出し）と同じです。
    //   url が不正な形式（例: "not-a-url"）の場合、例外を throw するためバリデーションを兼ねています。
    //   パース後は targetUrl.hostname でホスト名、targetUrl.pathname でパスなどを取得できます。
    //   例: new URL("https://api.example.com/path")
    //       → hostname: "api.example.com", pathname: "/path", protocol: "https:"
    let targetUrl: URL;
    try {
        targetUrl = new URL(url);
    } catch {
        throw new Error('無効なURL形式です');
    }

    // ガードレール: 許可リストのチェック
    // config.allowedDomains.some(domain => ...) について:
    //   .some() は配列の要素を1つずつ試し、コールバックが一度でも true を返したら true を返す高階関数です。
    //   Python の any(condition(d) for d in config.allowed_domains) に対応します。
    //   全要素が false なら false を返します（Python の any() と同じ挙動）。
    //
    //   domain => ... はアロー関数（コールバック）で、Python の lambda domain: ... に相当します。
    //   配列の各要素が domain に順番に渡され、条件を満たすかどうかを評価します。
    //
    //   targetUrl.hostname === domain
    //     完全一致チェック。例: "example.com" === "example.com" → true
    //   targetUrl.hostname.endsWith(`.${domain}`)
    //     サブドメインチェック。`.${domain}` はテンプレートリテラルで ".example.com" を生成します。
    //     例: "api.example.com".endsWith(".example.com") → true
    //     Python の "api.example.com".endswith(".example.com") と同じです。
    //   || は Python の or に対応し、どちらかが true なら true を返します。
    const isAllowed = config.allowedDomains.some(domain =>
        // 完全一致またはサブドメインだけを許可します。
        targetUrl.hostname === domain || targetUrl.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
        throw new Error(
            `セキュリティエラー: ドメイン '${targetUrl.hostname}' へのアクセスは許可されていません。\n` +
            `許可リスト: ${config.allowedDomains.join(', ')}`
        );
    }

    // 実際のフェッチ処理
    const response = await fetch(url, { redirect: 'error' });
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    return await response.text();
}

export const webFetch: Tool = {
    // 外部ネットワークアクセスは影響が大きいため、needsApproval を true にしています。
    name: 'webFetch',
    description: '指定されたURLのWebページを取得します',
    needsApproval: true,
    parameters: {
        type: 'object',
        properties: {
            url: { type: 'string', description: '取得したいURL' },
        },
        required: ['url'],
    },
    execute: webFetchExecute,
};
