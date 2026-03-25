#!/usr/bin/env bash
set -euo pipefail

BTCLI="${BTCLI:-btcli}"

"${BTCLI}" wallet create --uri alice --wallet-name alice --hotkey default

"${BTCLI}" wallet create \
  --wallet-name sn-creator \
  --hotkey default

"${BTCLI}" wallet create \
  --wallet-name test-validator \
  --hotkey default

"${BTCLI}" wallet create \
  --wallet-name test-blue-miner \
  --hotkey default

"${BTCLI}" wallet create \
  --wallet-name test-red-miner \
  --hotkey default
