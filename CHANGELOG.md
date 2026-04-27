# Change Log

## 2026-04-27

- Codex/Claude Code を API キーではなくサブスクのブラウザログインで使う方針に変更し、`.devcontainer/devcontainer.json` から `OPENAI_API_KEY` と `ANTHROPIC_API_KEY` の自動引き継ぎを削除しました。
- Codex と Claude Code の OAuth 認証情報が dev container の再作成後も残るよう、`/home/vscode/.codex` と `/home/vscode/.claude` を Docker volume として永続化しました。
- `.devcontainer/Dockerfile` の認証コメントを、Codex の ChatGPT プランログイン、Claude Code の Pro/Max ログイン、devcontainer で localhost callback が詰まる場合の手動コードフローに関する根拠へ更新しました。
- Codex CLI の OAuth callback で使われる `localhost:1455` がホストブラウザから dev container に届くよう、`forwardPorts` と `portsAttributes` を追加しました。
- `.devcontainer/Dockerfile` に、Dockerfile 初学者にも分かるように各命令の目的と注意点を説明するコメントを追加しました。
- `.devcontainer/devcontainer.json` の `build.dockerfile`、`workspaceFolder`、`remoteUser` と Dockerfile の対応関係を説明するコメントを追加しました。
- Dockerfile の実行命令自体は変更せず、開発コンテナの動作に影響しないコメント追加に限定しました。
