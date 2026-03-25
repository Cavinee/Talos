#!/usr/bin/env bash
set -euo pipefail

# Persist chain state across restarts by mounting /tmp (where the node stores data).
# Use "docker stop local_chain && docker start local_chain" to resume with existing state.
# Use "docker rm local_chain" first if you want a fresh chain.
docker run \
  --name local_chain \
  -p 9944:9944 \
  -p 9945:9945 \
  -v subtensor-local-data:/tmp \
  ghcr.io/opentensor/subtensor-localnet:devnet-ready
