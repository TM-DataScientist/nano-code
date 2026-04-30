FROM oven/bun:1.3

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    jq \
    curl \
    ca-certificates \
    npm \
    nano \
    bubblewrap \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# GitHub CLI (gh) のインストール
# 公式リポジトリを追加してからインストールします。
# Evidence: https://github.com/cli/cli/blob/trunk/docs/install_linux.md (2026-04-30 確認)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
 && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
 && apt-get update \
 && apt-get install -y --no-install-recommends gh \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Evidence checked on 2026-04-27:
# - OpenAI Codex CLI docs say ChatGPT Plus/Pro/Business/Edu/Enterprise plans include Codex,
#   and first run prompts for ChatGPT account or API key auth:
#   https://developers.openai.com/codex/cli
# - Anthropic Claude Code auth docs say Pro/Max users can log in with a Claude.ai account:
#   https://code.claude.com/docs/en/authentication
# - Anthropic troubleshooting says devcontainer login hangs usually mean the localhost
#   callback is blocked; use the manual code flow if the redirect cannot reach the CLI:
#   https://support.claude.com/en/articles/14552646-troubleshoot-claude-code-installation-and-authentication
RUN npm install -g @openai/codex @anthropic-ai/claude-code \
 && npm cache clean --force

RUN useradd -ms /bin/bash vscode

USER vscode
WORKDIR /nano-code

ENV EDITOR=nano
ENV DEVCONTAINER=true
ENV PATH="/home/vscode/.bun/bin:$PATH"
ENV BUN_INSTALL_CACHE=/home/vscode/.bun-cache

RUN mkdir -p "$BUN_INSTALL_CACHE" /home/vscode/.codex /home/vscode/.claude /home/vscode/.config/gh

CMD ["bash"]
