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

RUN npm install -g @openai/codex \
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
