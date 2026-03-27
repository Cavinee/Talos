#!/usr/bin/env bash
set -euo pipefail

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

"${PYTHON_BIN}" validator.py \
  --wallet.name test-validator \
  --wallet.hotkey default \
  --subtensor.network local \
  --netuid 2 \
  --logging.debug
