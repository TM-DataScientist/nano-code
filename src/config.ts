// src/config.ts
// アプリ全体で共有する簡易設定です。
// export しているため、他ファイルから `import { config } from '../config'` のように参照できます。
export let config = {
    // Layer 2: プロセス隔離（bubblewrap）
    sandbox: false,
    // Layer 3: アプリケーション層の設定
    allowedDomains: ['api.github.com', 'github.com'],
};
