#!/usr/bin/env bash
set -euo pipefail

NETWORK="${NETWORK:-ws://127.0.0.1:9945}"
NETUID="${NETUID:-2}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

register_wallet() {
  local wallet_name="$1"

  NETUID="${NETUID}" NETWORK="${NETWORK}" WALLET_NAME="${wallet_name}" \
    python3 "${SCRIPT_DIR}/../../register_subnet_neuron.py"
}

# Register 3 validators
for i in {1..3}; do
  register_wallet "test-validator-${i}"
done

# Register 5 red miners
for i in {1..5}; do
  register_wallet "test-red-miner-${i}"
done

# Register 5 blue miners
for i in {1..5}; do
  register_wallet "test-blue-miner-${i}"
done
