FROM node:20-alpine

# git, bash, vim, openssh をインストール
RUN apk add --no-cache git bash vim openssh rsync

# bashをデフォルトシェルに設定
#SHELL ["/bin/bash", "-c"]

#COPY .ssh/config /root/.ssh/
#COPY .ssh/id_ed25519_github_yontaku /root/.ssh/
USER node

WORKDIR /geo