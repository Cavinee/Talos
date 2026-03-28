#!/usr/bin/env bash
set -euo pipefail

BTCLI="${BTCLI:-btcli}"

# Create alice and sn-creator wallets
"${BTCLI}" wallet create --uri alice --wallet-name alice --hotkey default

"${BTCLI}" wallet create \
  --wallet-name sn-creator \
  --hotkey default

# Create 3 validator wallets
for i in {1..3}; do
  "${BTCLI}" wallet create \
    --wallet-name test-validator-${i} \
    --hotkey default
done

# Create 5 red miner wallets
for i in {1..5}; do
  "${BTCLI}" wallet create \
    --wallet-name test-red-miner-${i} \
    --hotkey default
done

# Create 5 blue miner wallets
for i in {1..5}; do
  "${BTCLI}" wallet create \
    --wallet-name test-blue-miner-${i} \
    --hotkey default
done
