#!/usr/bin/env bash
set -euo pipefail

BTCLI="${BTCLI:-btcli}"
NETWORK="${NETWORK:-ws://127.0.0.1:9945}"
NETUID="${NETUID:-2}"

"${BTCLI}" subnet create \
  --subnet-name talos \
  --wallet-name sn-creator \
  --hotkey default \
  --network "${NETWORK}" \
  --no-mev-protection

"${BTCLI}" subnet start --netuid "${NETUID}" \
  --wallet-name sn-creator \
  --hotkey default \
  --network "${NETWORK}"

# Disable commit-reveal on the started subnet so validators can reveal weights
# on localnet and miners can receive emissions.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NETUID="${NETUID}" NETWORK="${NETWORK}" python3 "${SCRIPT_DIR}/../../disable_commit_reveal.py"
