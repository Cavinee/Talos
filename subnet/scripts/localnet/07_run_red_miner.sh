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
REPO_ROOT="$(cd "${SUBNET_DIR}/.." && pwd)"
PRIMARY_REPO_ROOT="${REPO_ROOT}"
PYTHON_BIN="${PYTHON_BIN:-python}"
REQUESTED_PYTHON_BIN=""

if [[ "${REPO_ROOT}" == */.worktrees/* ]]; then
    PRIMARY_REPO_ROOT="$(cd "${REPO_ROOT}/../.." && pwd)"
fi

resolve_python_bin() {
    if [ -n "${REQUESTED_PYTHON_BIN}" ] && [ -x "${REQUESTED_PYTHON_BIN}" ]; then
        printf '%s\n' "${REQUESTED_PYTHON_BIN}"
        return 0
    fi

    local candidate=""
    for candidate in \
        "${SUBNET_DIR}/btsdk_venv/bin/python" \
        "${PRIMARY_REPO_ROOT}/subnet/btsdk_venv/bin/python"; do
        if [ -x "${candidate}" ]; then
            if [ -n "${REQUESTED_PYTHON_BIN}" ]; then
                echo "warning: PYTHON_BIN points to missing executable (${REQUESTED_PYTHON_BIN}); falling back to ${candidate}" >&2
            fi
            printf '%s\n' "${candidate}"
            return 0
        fi
    done

    if command -v python3 >/dev/null 2>&1; then
        if [ -n "${REQUESTED_PYTHON_BIN}" ]; then
            echo "warning: PYTHON_BIN points to missing executable (${REQUESTED_PYTHON_BIN}); falling back to $(command -v python3)" >&2
        fi
        command -v python3
        return 0
    fi

    if command -v python >/dev/null 2>&1; then
        if [ -n "${REQUESTED_PYTHON_BIN}" ]; then
            echo "warning: PYTHON_BIN points to missing executable (${REQUESTED_PYTHON_BIN}); falling back to $(command -v python)" >&2
        fi
        command -v python
        return 0
    fi

    echo "error: no usable Python interpreter found. Set PYTHON_BIN to an executable path." >&2
    return 1
}

# Load environment variables
ENV_FILE="${SUBNET_DIR}/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

REQUESTED_PYTHON_BIN="${PYTHON_BIN:-}"
PYTHON_BIN="${PYTHON_BIN:-python}"
CHAIN_ENDPOINT="${CHAIN_ENDPOINT:-ws://127.0.0.1:9945}"

cd "${SUBNET_DIR}"
PYTHON_BIN="$(resolve_python_bin)"

# Compute port: 8090 + INDEX (8091-8095)
PORT=$((8090 + INDEX))

"${PYTHON_BIN}" red_miner.py \
  --wallet.name test-red-miner-${INDEX} \
  --wallet.hotkey default \
  --subtensor.chain_endpoint "${CHAIN_ENDPOINT}" \
  --netuid 2 \
  --axon.port "${PORT}" \
  --miner-index "${INDEX}"
