import time
import random
import argparse
import bittensor as bt
from protocol import RedTeamSynapse, BlueTeamSynapse
from attack_pool import get_random_attacks


def get_config():
    parser = argparse.ArgumentParser()
    parser.add_argument("--role", type=str, required=True, choices=["red", "blue"])
    parser.add_argument("--netuid", type=int, default=1)
    parser.add_argument("--axon.port", type=int, default=8091)
    bt.wallet.add_args(parser)
    bt.subtensor.add_args(parser)
    bt.logging.add_args(parser)
    config = bt.config(parser)
    return config


def main():
    config = get_config()
    bt.logging(config=config)

    wallet = bt.wallet(config=config)
    subtensor = bt.subtensor(config=config)
    metagraph = subtensor.metagraph(config.netuid)

    if wallet.hotkey.ss58_address not in metagraph.hotkeys:
        bt.logging.error("Hotkey not registered. Run btcli subnet register first.")
        return

    uid = metagraph.hotkeys.index(wallet.hotkey.ss58_address)
    bt.logging.info(f"Running as {config.role} miner with UID {uid}")

    axon = bt.axon(wallet=wallet, port=config.axon.port)

    def red_forward(synapse: RedTeamSynapse) -> RedTeamSynapse:
        synapse.attack_prompts = get_random_attacks(5)
        bt.logging.info(f"Red miner generated {len(synapse.attack_prompts)} attack prompts")
        return synapse

    def blue_forward(synapse: BlueTeamSynapse) -> BlueTeamSynapse:
        synapse.classifications = [
            random.choice(["safe", "dangerous"]) for _ in synapse.prompts
        ]
        bt.logging.info(f"Blue miner classified {len(synapse.prompts)} prompts")
        return synapse

    def blacklist(synapse) -> tuple[bool, str]:
        return False, ""

    if config.role == "red":
        axon.attach(forward_fn=red_forward, blacklist_fn=blacklist)
    else:
        axon.attach(forward_fn=blue_forward, blacklist_fn=blacklist)

    axon.start()
    subtensor.serve_axon(axon=axon, netuid=config.netuid)
    bt.logging.info(f"{config.role.upper()} miner serving on port {config.axon.port}")

    step = 0
    while True:
        try:
            time.sleep(12)
            step += 1
            if step % 5 == 0:
                metagraph.sync()
                bt.logging.info(f"Step {step} | Block {metagraph.block}")
        except KeyboardInterrupt:
            bt.logging.info("Shutting down miner.")
            axon.stop()
            break


if __name__ == "__main__":
    main()
