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

# Evidence checked on 2026-04-27:
# - OpenAI Help Center documents OPENAI_API_KEY for Codex CLI authentication:
#   https://help.openai.com/en/articles/11096431-openai-codex-ci-getting-started
# - Anthropic/Docker docs recommend ANTHROPIC_API_KEY for containerized Claude Code auth:
#   https://docs.docker.com/ai/sandboxes/agents/claude-code/
# Browser OAuth callbacks can hang in containers when host localhost is not forwarded.
RUN npm install -g @openai/codex @anthropic-ai/claude-code \
 && npm cache clean --force

RUN useradd -ms /bin/bash vscode

USER vscode
WORKDIR /nano-code

ENV EDITOR=nano
ENV DEVCONTAINER=true
ENV PATH="/home/vscode/.bun/bin:$PATH"
ENV BUN_INSTALL_CACHE=/home/vscode/.bun-cache

RUN mkdir -p "$BUN_INSTALL_CACHE"

CMD ["bash"]
