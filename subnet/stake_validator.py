"""
Stake TAO for the validator on localnet in small rounds to avoid slippage.

Bypasses btcli's interactive prompts and password re-entry.
"""

import os
import time

import bittensor as bt
from bittensor_wallet import Wallet

NETUID = int(os.environ.get("NETUID", 2))
NETWORK = os.environ.get("NETWORK", "local")
STAKE_PER_ROUND = int(os.environ.get("STAKE_PER_ROUND", 100))
TARGET_ROUNDS = int(os.environ.get("STAKE_ROUNDS", 30))
WALLET_NAME = os.environ.get("WALLET_NAME", "test-validator")

wallet = Wallet(name=WALLET_NAME)
subtensor = bt.Subtensor(network=NETWORK)

metagraph = subtensor.metagraph(netuid=NETUID)
validator_uid = metagraph.hotkeys.index(wallet.hotkey.ss58_address)

for i in range(1, TARGET_ROUNDS + 1):
    balance = subtensor.get_balance(wallet.coldkey.ss58_address)
    if balance.tao < STAKE_PER_ROUND:
        print(f"Round {i}: insufficient balance ({balance.tao:.2f} TAO), stopping.")
        break

    try:
        success, message = subtensor.add_stake(
            wallet=wallet,
            hotkey_ss58=wallet.hotkey.ss58_address,
            netuid=NETUID,
            amount=bt.Balance.from_tao(STAKE_PER_ROUND),
            safe_staking=False,
            allow_partial_stake=True,
            wait_for_inclusion=True,
            wait_for_finalization=True,
        )
        if success:
            metagraph.sync()
            stake = metagraph.stake[validator_uid]
            print(f"Round {i}/{TARGET_ROUNDS}: staked {STAKE_PER_ROUND} TAO | total stake: {stake:.2f} β")
        else:
            print(f"Round {i}/{TARGET_ROUNDS}: failed — {message}")
    except Exception as e:
        print(f"Round {i}/{TARGET_ROUNDS}: error — {e}")

    time.sleep(1)

metagraph.sync()
stake = metagraph.stake[validator_uid]
print(f"\nDone. Validator stake: {stake:.2f} β")
