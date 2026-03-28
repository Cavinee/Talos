from __future__ import annotations

import os
import re
import sys


RETRY_BLOCKS_PATTERN = re.compile(r"Try again in (\d+) blocks", re.IGNORECASE)
INTERVAL_LIMIT_PATTERNS = (
    "full for this interval",
    "TooManyRegistrationsThisInterval",
    "Custom error: 6",
)


def parse_retry_blocks(message: str) -> int | None:
    match = RETRY_BLOCKS_PATTERN.search(message)
    if not match:
        return None
    return int(match.group(1))


def is_interval_rate_limit_error(message: str) -> bool:
    normalized_message = message.lower()
    return any(pattern.lower() in normalized_message for pattern in INTERVAL_LIMIT_PATTERNS)


def calculate_next_interval_block(current_block: int, adjustment_interval: int) -> int:
    return current_block + adjustment_interval + 1


def fallback_retry_block(subtensor, netuid: int) -> int | None:
    hyperparameters = subtensor.get_subnet_hyperparameters(netuid)
    if hyperparameters is None:
        return None

    adjustment_interval = getattr(hyperparameters, "adjustment_interval", None)
    if not adjustment_interval:
        return None

    current_block = subtensor.get_current_block()
    return calculate_next_interval_block(
        current_block=current_block,
        adjustment_interval=adjustment_interval,
    )


def register_with_interval_retry(subtensor, wallet, netuid: int, max_attempts: int = 20):
    for attempt in range(1, max_attempts + 1):
        try:
            return subtensor.burned_register(
                wallet=wallet,
                netuid=netuid,
                raise_error=True,
                wait_for_inclusion=True,
                wait_for_finalization=True,
            )
        except Exception as exc:
            message = str(exc)
            retry_blocks = parse_retry_blocks(message)
            if retry_blocks is not None:
                current_block = subtensor.get_current_block()
                target_block = current_block + retry_blocks + 1
            elif is_interval_rate_limit_error(message):
                target_block = fallback_retry_block(subtensor=subtensor, netuid=netuid)
            else:
                target_block = None

            if target_block is None or attempt == max_attempts:
                raise

            print(
                f"Registration window is full for wallet {wallet.name}. "
                f"Waiting until block {target_block} and retrying "
                f"({attempt}/{max_attempts})...",
                flush=True,
            )
            subtensor.wait_for_block(block=target_block)

    raise RuntimeError("Registration retry loop exited unexpectedly.")


def main() -> int:
    wallet_name = os.environ.get("WALLET_NAME")
    hotkey_name = os.environ.get("WALLET_HOTKEY", "default")
    network = os.environ.get("NETWORK", "ws://127.0.0.1:9945")
    netuid = int(os.environ.get("NETUID", "2"))
    max_attempts = int(os.environ.get("MAX_REGISTRATION_ATTEMPTS", "20"))

    if not wallet_name:
        print("WALLET_NAME environment variable is required.", file=sys.stderr)
        return 1

    import bittensor as bt
    from bittensor_wallet import Wallet

    wallet = Wallet(name=wallet_name, hotkey=hotkey_name)
    subtensor = bt.Subtensor(network=network)

    register_with_interval_retry(
        subtensor=subtensor,
        wallet=wallet,
        netuid=netuid,
        max_attempts=max_attempts,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
