# セキュアで最小限の Bun 開発環境を作るための Dockerfile です。
#
# Dockerfile は「どの OS/実行環境を元にして、どんなソフトを入れ、
# どのユーザーで、どのディレクトリから作業を始めるか」を上から順番に書く設計図です。
# このファイルは devcontainer から使われる想定で、Bun を使った開発に必要なものだけを入れます。
#
# .devcontainer/devcontainer.json との関係:
# - devcontainer.json は「VS Code や Codespaces がどの開発コンテナを使うか」を指定する設定ファイルです。
# - その中の build.dockerfile がこの Dockerfile を指しているため、開発環境を作るときにこの手順が実行されます。
# - devcontainer.json はコンテナの使い方を決め、この Dockerfile はコンテナの中身を作る役割です。
# - workspaceFolder や mounts で指定された /nano-code は、下の WORKDIR と対応しています。
# - remoteUser が vscode なので、下で vscode ユーザーを作成し、USER vscode に切り替えています。
#
# 方針:
# - 公式の Bun イメージを土台にして、Bun 本体の準備を任せる
# - root ではない一般ユーザーで作業し、誤操作や権限の影響範囲を小さくする
# - apt のキャッシュを削除し、イメージサイズと不要ファイルを減らす
#
# 参考:
# - FROM / RUN / USER / WORKDIR / ENV / CMD は Dockerfile の代表的な命令です。
# - 各命令は基本的に上から順に実行され、結果が Docker イメージのレイヤーとして保存されます。
FROM oven/bun:1.3

# apt-get は Debian/Ubuntu 系 Linux でソフトウェアを入れるためのコマンドです。
# oven/bun イメージは Debian 系を元にしているため、apt-get で追加ツールを入れます。
#
# ここで入れているもの:
# - git: ソースコードの取得やコミット履歴の確認に使う
# - jq: JSON をコマンドラインで整形・抽出するために使う
# - curl: HTTP リクエストやファイル取得に使う
# - ca-certificates: HTTPS 通信で証明書を検証するために使う
# - nano: コンテナ内で簡単にファイルを編集するためのテキストエディタ
# - bubblewrap: サンドボックス実行など、権限を制限したプロセス起動に使う
#
# --no-install-recommends は「推奨パッケージ」まで自動で入れない指定です。
# 必要最小限にすることで、イメージサイズと攻撃対象になるソフトウェアを減らします。
#
# apt-get update でパッケージ一覧を更新し、apt-get install で必要なものを入れます。
# 最後に apt-get clean と /var/lib/apt/lists の削除を行い、
# ビルド時だけ必要だった apt のキャッシュをイメージ内に残さないようにします。
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    jq \
    curl \
    ca-certificates \
    nano  \
    bubblewrap \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# Docker コンテナの初期状態では root ユーザーで動くことが多いです。
# root はシステム全体を変更できる強い権限を持つため、開発時の通常作業には向きません。
#
# useradd -ms /bin/bash vscode は、次の意味です。
# - useradd: Linux ユーザーを追加する
# - -m: /home/vscode というホームディレクトリを作成する
# - -s /bin/bash: ログインシェルを bash にする
# - vscode: 作成するユーザー名
RUN useradd -ms /bin/bash vscode

# ここから下の命令や、コンテナ起動後の標準ユーザーを vscode に切り替えます。
# これにより、コンテナ内で実行するコマンドが root 権限を持たなくなります。
USER vscode

# コンテナ内でコマンドを実行するときの作業ディレクトリです。
# devcontainer では、この場所にプロジェクトがマウントされる想定です。
# 以降の相対パスは基本的に /nano-code を起点に解釈されます。
WORKDIR /nano-code

# ENV は環境変数を設定する Dockerfile 命令です。
# 環境変数は、コンテナ内のプログラムに設定値を渡すためによく使われます。
#
# EDITOR は、git commit などがエディタを必要としたときに使う既定エディタです。
# ここでは nano を指定しています。プロジェクト名の nano-code とは無関係です。
ENV EDITOR=nano

# DEVCONTAINER=true は「devcontainer 内で動いている」ことをプログラム側から判定しやすくする目印です。
ENV DEVCONTAINER=true

# PATH は、コマンド名だけで実行ファイルを探す場所の一覧です。
# /home/vscode/.bun/bin を先頭に追加し、vscode ユーザーの Bun 関連コマンドを見つけやすくします。
# $PATH は元から設定されている検索パスを残すための書き方です。
ENV PATH="/home/vscode/.bun/bin:$PATH"

# Bun が依存パッケージなどを保存するキャッシュディレクトリを指定します。
# root ではなく vscode ユーザーのホーム配下に置くことで、権限トラブルを避けやすくします。
ENV BUN_INSTALL_CACHE=/home/vscode/.bun-cache

# 上で指定したキャッシュディレクトリを作成します。
# この時点では USER vscode に切り替わっているため、作成されるディレクトリは vscode ユーザーが扱えます。
RUN mkdir -p $BUN_INSTALL_CACHE

# コンテナ起動時に明示的なコマンドが指定されなかった場合、bash を起動します。
# devcontainer ではエディタやシェルが接続するため、対話しやすい bash を既定にしています。
CMD ["bash"]
