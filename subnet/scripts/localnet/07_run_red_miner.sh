#!/usr/bin/env bash
set -euo pipefail

# Check for index argument
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <INDEX>"
  echo "  <INDEX>: Miner index (1-5)"
  echo ""
  echo "Example: $0 1"
  echo "  Runs red miner with wallet test-red-miner-1 on port 8091"
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

# Compute port: 8090 + INDEX (8091-8095)
PORT=$((8090 + INDEX))

"${PYTHON_BIN}" red_miner.py \
  --wallet.name test-red-miner-${INDEX} \
  --wallet.hotkey default \
  --subtensor.network local \
  --netuid 2 \
  --axon.port "${PORT}" \
  --miner-index "${INDEX}"
