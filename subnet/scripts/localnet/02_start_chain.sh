#!/usr/bin/env bash
set -euo pipefail

# Persist chain state across restarts by mounting /tmp (where the node stores data).
# Use "docker rm local_chain" first if you want a fresh chain.
if docker container inspect local_chain >/dev/null 2>&1; then
  docker start local_chain
  exit 0
fi

docker run -d \
  --name local_chain \
  -p 9944:9944 \
  -p 9945:9945 \
  -v subtensor-local-data:/tmp \
  ghcr.io/opentensor/subtensor-localnet:devnet-ready
