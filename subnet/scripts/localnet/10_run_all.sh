#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Array to store PIDs of background processes
declare -a PIDS=()
declare -a VALIDATOR_PIDS=()

terminate_all_processes() {
  local exit_code="${1:-0}"
  local emit_stop_sentinel="${2:-false}"

  echo ""

  if [[ "${emit_stop_sentinel}" == "true" ]]; then
    echo "All miners and validators stopped."
  fi

  echo "Terminating all processes..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "All processes terminated."
  exit "${exit_code}"
}

# Function to clean up child processes on exit
cleanup() {
  terminate_all_processes 0 true
}

# Set trap to catch SIGINT (Ctrl+C)
trap cleanup SIGINT

echo "Launching 13 processes (5 red miners, 5 blue miners, 3 validators)..."
echo ""

# Launch 5 red miners
echo "Launching 5 red miners..."
for i in {1..5}; do
  "${SCRIPT_DIR}/07_run_red_miner.sh" "$i" &
  pid=$!
  PIDS+=("$pid")
  echo "  Red miner $i started (PID: $pid)"
done

# Launch 5 blue miners
echo "Launching 5 blue miners..."
for i in {1..5}; do
  "${SCRIPT_DIR}/08_run_blue_miner.sh" "$i" &
  pid=$!
  PIDS+=("$pid")
  echo "  Blue miner $i started (PID: $pid)"
done

# Launch 3 validators
echo "Launching 3 validators..."
for i in {1..3}; do
  "${SCRIPT_DIR}/09_run_validator.sh" "$i" &
  pid=$!
  PIDS+=("$pid")
  VALIDATOR_PIDS+=("$pid")
  echo "  Validator $i started (PID: $pid)"
done

echo ""
echo "All 13 processes launched. Waiting for validators to assign weights."
echo ""

remaining_validators=("${VALIDATOR_PIDS[@]}")

while ((${#remaining_validators[@]} > 0)); do
  active_validators=()
  for pid in "${remaining_validators[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      active_validators+=("$pid")
      continue
    fi

    if ! wait "$pid"; then
      echo "A validator exited before completing all epochs."
      terminate_all_processes 1 false
    fi
  done
  remaining_validators=("${active_validators[@]}")

  if ((${#remaining_validators[@]} > 0)); then
    sleep 1
  fi
done

echo "All validators completed. Stopping miners."
terminate_all_processes 0 true
