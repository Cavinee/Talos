#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

"${SCRIPT_DIR}/06_register_neurons.sh"
"${SCRIPT_DIR}/07_stake_validators.sh"
