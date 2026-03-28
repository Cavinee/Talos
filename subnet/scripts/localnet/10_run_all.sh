#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Array to store PIDs of background processes
declare -a PIDS=()

# Function to clean up child processes on exit
cleanup() {
  echo ""
  echo "Terminating all processes..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "All processes terminated."
  exit 0
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
  echo "  Validator $i started (PID: $pid)"
done

echo ""
echo "All 13 processes launched. Press Ctrl+C to terminate all."
echo ""

# Wait for all background processes
wait
