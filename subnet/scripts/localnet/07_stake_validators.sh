#!/usr/bin/env bash
set -euo pipefail

NETWORK="${NETWORK:-ws://127.0.0.1:9945}"
NETUID="${NETUID:-2}"
VALIDATOR_STAKE_AMOUNT="${VALIDATOR_STAKE_AMOUNT:-100}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Stake all 3 validators via SDK to avoid repeated password prompts.
# Stakes in small rounds to avoid slippage rejection on the bonding curve.
for i in {1..3}; do
  NETUID="${NETUID}" NETWORK="${NETWORK}" STAKE_PER_ROUND="${VALIDATOR_STAKE_AMOUNT}" \
    WALLET_NAME="test-validator-${i}" \
    python3 "${SCRIPT_DIR}/../../stake_validator.py"
done
