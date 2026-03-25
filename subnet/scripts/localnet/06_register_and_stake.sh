#!/usr/bin/env bash
set -euo pipefail

BTCLI="${BTCLI:-btcli}"
NETWORK="${NETWORK:-ws://127.0.0.1:9945}"
NETUID="${NETUID:-2}"
VALIDATOR_STAKE_AMOUNT="${VALIDATOR_STAKE_AMOUNT:-100}"

"${BTCLI}" subnets register --netuid "${NETUID}" \
  --wallet-name test-validator \
  --hotkey default \
  --network "${NETWORK}"

"${BTCLI}" subnets register --netuid "${NETUID}" \
  --wallet-name test-red-miner \
  --hotkey default \
  --network "${NETWORK}"

"${BTCLI}" subnets register --netuid "${NETUID}" \
  --wallet-name test-blue-miner \
  --hotkey default \
  --network "${NETWORK}"

# Stake programmatically via the SDK to avoid repeated password prompts.
# Stakes in small rounds to avoid slippage rejection on the bonding curve.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NETUID="${NETUID}" NETWORK="${NETWORK}" STAKE_PER_ROUND="${VALIDATOR_STAKE_AMOUNT}" \
  python3 "${SCRIPT_DIR}/../../stake_validator.py"
