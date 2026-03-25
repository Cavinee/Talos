#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Pulling the localnet image..."
"${SCRIPT_DIR}/01_pull_image.sh"

echo
echo "Start the chain in a separate terminal with:"
echo "  ${SCRIPT_DIR}/02_start_chain.sh"
read -r -p "Press Enter after the local chain is running on ws://127.0.0.1:9945..."

echo "Creating wallets..."
"${SCRIPT_DIR}/03_create_wallets.sh"

echo "Funding wallets..."
"${SCRIPT_DIR}/04_fund_wallets.sh"

echo "Creating and starting subnet..."
"${SCRIPT_DIR}/05_create_subnet.sh"

echo "Registering neurons and staking validator..."
"${SCRIPT_DIR}/06_register_and_stake.sh"

echo
echo "Setup complete. Run the nodes in separate terminals:"
echo "  ${SCRIPT_DIR}/07_run_red_miner.sh"
echo "  ${SCRIPT_DIR}/08_run_blue_miner.sh"
echo "  ${SCRIPT_DIR}/09_run_validator.sh"
