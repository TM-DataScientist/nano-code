// tools ディレクトリの公開窓口です。
// 他のファイルは `src/tools/index.ts` からまとめて import できます。
export { readFile } from './readFile';
export { writeFile } from './writeFile';
export { editFile } from './editFile';
export { execCommand } from './execCommand';

import { readFile } from './readFile';
import { writeFile } from './writeFile';
import { editFile } from './editFile';
import { execCommand } from './execCommand';

// Agent にまとめて渡すための標準ツール一覧です。
// 配列にすることで、後段の処理は for...of や find で共通に扱えます。
export const allTools = [readFile, writeFile, editFile, execCommand];
