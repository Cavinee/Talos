#!/usr/bin/env bash
set -euo pipefail

# Check for index argument
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <INDEX>"
  echo "  <INDEX>: Miner index (1-5)"
  echo ""
  echo "Example: $0 1"
  echo "  Runs blue miner with wallet test-blue-miner-1 on port 8096"
  exit 1
fi

INDEX="$1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUBNET_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python}"

# Load environment variables
ENV_FILE="${SUBNET_DIR}/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

cd "${SUBNET_DIR}"

# Compute port: 8095 + INDEX (8096-8100)
PORT=$((8095 + INDEX))

"${PYTHON_BIN}" blue_miner.py \
  --wallet.name test-blue-miner-${INDEX} \
  --wallet.hotkey default \
  --subtensor.network local \
  --netuid 2 \
  --axon.port "${PORT}" \
  --miner-index "${INDEX}"
