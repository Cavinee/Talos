"""
Disable commit-reveal weights on localnet.

Uses system.setStorage via the Sudo pallet to write directly to chain storage,
bypassing the AdminFreezeWindow check which blocks all other approaches when
tempo <= freeze window (10 blocks).
"""

import os

import bittensor as bt
from bittensor.core.extrinsics.pallets.sudo import Sudo
from bittensor_wallet import Wallet

NETUID = int(os.environ.get("NETUID", 2))
NETWORK = os.environ.get("NETWORK", "local")

wallet = Wallet(name="alice")
subtensor = bt.Subtensor(network=NETWORK)

# Build the storage key for CommitRevealWeightsEnabled(netuid)
storage_key = subtensor.substrate.create_storage_key(
    "SubtensorModule", "CommitRevealWeightsEnabled", [NETUID]
)

# Encode False as SCALE bool (0x00)
value = "0x00"

# Write directly to storage via sudo, bypassing all pallet-level checks
set_storage_call = subtensor.compose_call(
    call_module="System",
    call_function="set_storage",
    call_params={"items": [[storage_key.to_hex(), value]]},
)
sudo_call = Sudo(subtensor).sudo(set_storage_call)

response = subtensor.sign_and_send_extrinsic(
    call=sudo_call,
    wallet=wallet,
    wait_for_inclusion=True,
    wait_for_finalization=True,
)

if response.success:
    params = subtensor.get_subnet_hyperparameters(netuid=NETUID)
    if not params.commit_reveal_weights_enabled:
        print(f"Success! commit_reveal_weights_enabled is now disabled for netuid {NETUID}")
    else:
        print("Warning: extrinsic succeeded but value did not change")
        raise SystemExit(1)
else:
    print(f"Failed: {response.message}")
    print(f"Error: {response.error}")
    raise SystemExit(1)
