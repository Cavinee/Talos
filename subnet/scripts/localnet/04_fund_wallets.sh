#!/usr/bin/env bash
set -euo pipefail

BTCLI="${BTCLI:-btcli}"
NETWORK="${NETWORK:-ws://127.0.0.1:9945}"
WALLET_ROOT="${WALLET_ROOT:-${HOME}/.bittensor/wallets}"
SN_CREATOR_TAO="${SN_CREATOR_TAO:-1100}"
VALIDATOR_TAO="${VALIDATOR_TAO:-5000}"
MINER_TAO="${MINER_TAO:-50}"

coldkey_address() {
  local wallet_name="$1"
  local coldkey_file="${WALLET_ROOT}/${wallet_name}/coldkeypub.txt"

  if [[ ! -f "${coldkey_file}" ]]; then
    echo "Missing coldkey file: ${coldkey_file}" >&2
    exit 1
  fi

  sed -nE 's/.*"ss58Address":"([^"]+)".*/\1/p' "${coldkey_file}"
}

"${BTCLI}" wallet transfer \
  --wallet-name alice \
  --destination "$(coldkey_address sn-creator)" \
  --amount "${SN_CREATOR_TAO}" \
  --network "${NETWORK}"

"${BTCLI}" wallet transfer \
  --wallet-name alice \
  --destination "$(coldkey_address test-validator)" \
  --amount "${VALIDATOR_TAO}" \
  --network "${NETWORK}"

"${BTCLI}" wallet transfer \
  --wallet-name alice \
  --destination "$(coldkey_address test-red-miner)" \
  --amount "${MINER_TAO}" \
  --network "${NETWORK}"

"${BTCLI}" wallet transfer \
  --wallet-name alice \
  --destination "$(coldkey_address test-blue-miner)" \
  --amount "${MINER_TAO}" \
  --network "${NETWORK}"
