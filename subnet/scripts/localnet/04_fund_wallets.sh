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

# Fund sn-creator
"${BTCLI}" wallet transfer \
  --wallet-name alice \
  --destination "$(coldkey_address sn-creator)" \
  --amount "${SN_CREATOR_TAO}" \
  --network "${NETWORK}"

# Fund 3 validators (5000 TAO each)
for i in {1..3}; do
  "${BTCLI}" wallet transfer \
    --wallet-name alice \
    --destination "$(coldkey_address test-validator-${i})" \
    --amount "${VALIDATOR_TAO}" \
    --network "${NETWORK}"
done

# Fund 5 red miners (50 TAO each)
for i in {1..5}; do
  "${BTCLI}" wallet transfer \
    --wallet-name alice \
    --destination "$(coldkey_address test-red-miner-${i})" \
    --amount "${MINER_TAO}" \
    --network "${NETWORK}"
done

# Fund 5 blue miners (50 TAO each)
for i in {1..5}; do
  "${BTCLI}" wallet transfer \
    --wallet-name alice \
    --destination "$(coldkey_address test-blue-miner-${i})" \
    --amount "${MINER_TAO}" \
    --network "${NETWORK}"
done
