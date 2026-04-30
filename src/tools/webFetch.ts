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
    const url = args.url as string;

    // URLのパース（バリデーション含む）
    let targetUrl: URL;
    try {
        targetUrl = new URL(url);
    } catch {
        throw new Error('無効なURL形式です');
    }

    // ガードレール: 許可リストのチェック
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
