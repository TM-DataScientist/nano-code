import * as path from 'path';

// 機密ファイルのパターン
// 正規表現リテラル `/.../` を配列にして、危険なファイル名をまとめて判定します。
const SENSITIVE_FILE_PATTERNS = [
    /\.env$/,
    /\.env\./,
    /credentials\.json$/,
    /\.ssh\/id_rsa$/,
    /\.pgpass$/,
    /\.kube\/config$/,
    /\.aws\/credentials$/,
];

export function isSensitiveFile(filePath: string): boolean {
    // some は「1つでも true なら true」を返します。
    // Python の any(...) に近いメソッドです。
    return SENSITIVE_FILE_PATTERNS.some(pattern =>
        pattern.test(path.normalize(filePath))
    );
}

// 危険なコマンドパターン
const DANGEROUS_PATTERNS = [
    /[^\\]>/,                // リダイレクト（>、>>）
    /\$\(/,                  // コマンド置換 $()
    /`/,                     // バッククォート置換
    /\beval\b/,              // eval
    /\$\{[^}]*##/,          // 変数難読化
];

export function isDangerousCommand(command: string): { dangerous: boolean; reason?: string } {
    // 戻り値の型を `{ dangerous: boolean; reason?: string }` とその場で書いています。
    // reason は危険と判定した場合だけ付く省略可能プロパティです。
    if (/\bsudo\b/.test(command)) {
        return { dangerous: true, reason: 'sudo による権限昇格は禁止されています' };
    }
    if (DANGEROUS_PATTERNS.some(pattern => pattern.test(command))) {
        return { dangerous: true, reason: '危険なパターンが検出されました' };
    }
    return { dangerous: false };
}

const ALLOWED_ENV_VARS = [
    'PATH',
    'HOME',
    'USER',
    'LANG',
    'NODE_ENV',
    'BUN_ENV',
];

export function filterEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    // Object.entries はオブジェクトを [key, value] の配列に変換します。
    // filter 後に Object.fromEntries でオブジェクトへ戻しています。
    return Object.fromEntries(
        Object.entries(env).filter(([key]) => ALLOWED_ENV_VARS.includes(key))
    );
}
