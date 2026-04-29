// tools ディレクトリの公開窓口です。
// 他のファイルは `src/tools/index.ts` からまとめて import できます。
// Python の __init__.py に対応し、利用者が個別ファイルのパスを知らなくても済みます。

// import { X } from './X' は「このファイル内で使うために取り込む」宣言です（Python の from .X import X と同じ）。
// export だけでは「外に公開」するだけで、このファイル自身の中では使えないため、
// allTools 配列に入れるために別途 import が必要です。
import { readFile } from './readFile';
import { writeFile } from './writeFile';
import { editFile } from './editFile';
import { execCommand } from './execCommand';

// export { X } from './X' は「取り込んで外に公開する」再エクスポートです。
// 外部ファイルが `import { readFile } from './tools'` のように使えるようになります。
// Python での `from .readFile import readFile`（__init__.py 内）に近い書き方です。
export { readFile } from './readFile';
export { writeFile } from './writeFile';
export { editFile } from './editFile';
export { execCommand } from './execCommand';

// Agent にまとめて渡すための標準ツール一覧です。
// 配列にすることで、後段の処理は for...of や find で共通に扱えます。
export const allTools = [readFile, writeFile, editFile, execCommand];
