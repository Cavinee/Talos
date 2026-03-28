#!/usr/bin/env bash
set -euo pipefail

# Check for index argument
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <INDEX>"
  echo "  <INDEX>: Validator index (1-3)"
  echo ""
  echo "Example: $0 1"
  echo "  Runs validator with wallet test-validator-1"
  exit 1
fi

INDEX="$1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUBNET_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python}"
MINIMUM_RED_MINERS="${MINIMUM_RED_MINERS:-5}"
MINIMUM_BLUE_MINERS="${MINIMUM_BLUE_MINERS:-5}"
ROLE_DISCOVERY_MAX_ATTEMPTS="${ROLE_DISCOVERY_MAX_ATTEMPTS:-30}"
ROLE_DISCOVERY_POLL_INTERVAL="${ROLE_DISCOVERY_POLL_INTERVAL:-2}"

# Load environment variables
ENV_FILE="${SUBNET_DIR}/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

cd "${SUBNET_DIR}"

export MINIMUM_RED_MINERS MINIMUM_BLUE_MINERS ROLE_DISCOVERY_MAX_ATTEMPTS ROLE_DISCOVERY_POLL_INTERVAL

"${PYTHON_BIN}" validator.py \
  --wallet.name test-validator-${INDEX} \
  --wallet.hotkey default \
  --subtensor.network local \
  --netuid 2 \
  --logging.debug
