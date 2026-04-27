# Change Log

## 2026-04-27

- dev container 内の Codex/Claude Code 認証がブラウザ callback で止まりやすい問題に対し、`.devcontainer/devcontainer.json` で `OPENAI_API_KEY` と `ANTHROPIC_API_KEY` をホスト環境から引き継ぐ設定を追加しました。
- Codex CLI の OAuth callback で使われる `localhost:1455` がホストブラウザから dev container に届くよう、`forwardPorts` と `portsAttributes` を追加しました。
- `.devcontainer/Dockerfile` に、2026-04-27 時点で確認した OpenAI/Anthropic の認証方式と、コンテナ内 OAuth callback が詰まる原因の根拠コメントを追加しました。
- `.devcontainer/Dockerfile` に、Dockerfile 初学者にも分かるように各命令の目的と注意点を説明するコメントを追加しました。
- `.devcontainer/devcontainer.json` の `build.dockerfile`、`workspaceFolder`、`remoteUser` と Dockerfile の対応関係を説明するコメントを追加しました。
- Dockerfile の実行命令自体は変更せず、開発コンテナの動作に影響しないコメント追加に限定しました。
