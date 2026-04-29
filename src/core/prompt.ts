import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Modules では CommonJS の __filename / __dirname が標準では使えません。
// import.meta.url は、今実行しているこのモジュールファイルの場所を URL 形式で表す値です。
// import.meta.url をファイルパスへ変換して、Python の __file__ に近い値を作っています。
// import.meta.url は "file:///..." 形式の URL なので、fileURLToPath で OS が扱える通常のパス文字列に戻します。
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ベースプロンプト（prompt.md）とプロジェクト固有の指示（AGENTS.md）を読み込む。
 *
 * - prompt.md は必須。存在しない場合はエラーを投げる。
 * - workspaceRoot 配下に AGENTS.md があれば連結して返す。
 */
export function loadInstructions(workspaceRoot: string): string {
  // path.resolve は絶対パスへ正規化します。
  // prompt.md はこの TypeScript ファイルと同じ core ディレクトリに置かれている前提です。
  const basePath = path.resolve(path.join(__dirname, 'prompt.md'));
  // fs.readFileSync は指定したファイルを同期的に読み込みます。
  // 'utf-8' を指定しているため、Buffer ではなく文字列として base に入ります。
  // Python なら open(basePath, encoding='utf-8').read() に近い処理です。
  const base = fs.readFileSync(basePath, 'utf-8');

  // workspaceRoot はエージェントが作業するプロジェクトのルートです。
  // そこに AGENTS.md があれば、共通プロンプトに追加してプロジェクト固有ルールとして扱います。
  const agentsPath = path.join(workspaceRoot, 'AGENTS.md');
  // fs.existsSync は指定したパスが存在するかを同期的に確認し、true / false を返します。
  // Python なら Path(agentsPath).exists() や os.path.exists(agentsPath) に近い判定です。
  if (fs.existsSync(agentsPath)) {
    const agents = fs.readFileSync(agentsPath, 'utf-8');
    return `${base}\n\n# プロジェクト固有の指示\n\n${agents}`;
  }

  return base;
}
