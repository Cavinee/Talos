import argparse
import os
import time
import traceback
from typing import Tuple

from bittensor import Subtensor, Config, Axon
from bittensor.utils.btlogging import logging
from bittensor_wallet import Wallet

from bittensor_network import resolve_subtensor_target
from protocol import RoleDiscoverySynapse, BlueTeamSynapse
from mock_data import BLUE_MINER_ACCURACY, get_mock_blue_classification
# from shield_model import ShieldModel  # Shield implementation (commented out for mock testing)


class BlueMiner:
    def __init__(self):
        self.subtensor = None
        self.wallet = None
        self.metagraph = None
        self.axon = None
        self.my_subnet_uid = None

        self.config = self.get_config()
        self.setup_logging()
        self.setup_bittensor_objects()
        # Shield implementation (commented out for mock testing)
        # self.model_path = os.environ.get(
        #     "SHIELD_MODEL_PATH",
        #     os.path.join(os.path.dirname(__file__), "models", "shield_model"),
        # )
        # self.dangerous_prompts_path = os.path.join(
        #     os.path.dirname(__file__), "dangerous_prompts.json"
        # )
        # self.model_poll_interval_sec = int(
        #     os.environ.get("SHIELD_MODEL_POLL_INTERVAL_SEC", "5")
        # )
        # self.fine_tune_threshold = int(
        #     os.environ.get("SHIELD_FINE_TUNE_THRESHOLD", "10")
        # )
        # self.seen_dangerous_prompt_keys = self._load_seen_dangerous_prompt_keys()
        # self.shield = self._load_shield()

        # Mock mode initialization
        self.accuracy = BLUE_MINER_ACCURACY.get(self.config.miner_index, 0.5)

    def get_config(self):
        # Set up the configuration parser
        parser = argparse.ArgumentParser()
        # Adds override arguments for network and netuid.
        parser.add_argument(
            "--netuid", type=int, default=1, help="The chain subnet uid."
        )
        # Adds miner index for mock mode accuracy lookup.
        parser.add_argument(
            "--miner-index", type=int, default=1, help="Miner index (1-5) for mock mode accuracy."
        )
        # Adds subtensor specific arguments.
        Subtensor.add_args(parser)
        # Adds logging specific arguments.
        logging.add_args(parser)
        # Adds wallet specific arguments.
        Wallet.add_args(parser)
        # Adds axon specific arguments.
        Axon.add_args(parser)
        # Parse the arguments.
        config = Config(parser)
        # Set up logging directory
        config.full_path = os.path.expanduser(
            "{}/{}/{}/netuid{}/{}".format(
                config.logging.logging_dir,
                config.wallet.name,
                config.wallet.hotkey,
                config.netuid,
                "blue_miner",
            )
        )
        # Ensure the directory for logging exists.
        os.makedirs(config.full_path, exist_ok=True)
        return config

    def setup_logging(self):
        # Activate Bittensor's logging with the set configurations.
        logging(config=self.config, logging_dir=self.config.full_path)
        logging.info(f"Running blue miner for subnet: {self.config.netuid}")
        logging.info(self.config)

    def setup_bittensor_objects(self):
        # Initialize Bittensor miner objects
        logging.info("Setting up Bittensor objects.")

        # Initialize wallet.
        self.wallet = Wallet(config=self.config)
        logging.info(f"Wallet: {self.wallet}")

        # Initialize subtensor.
        self.subtensor = Subtensor(
            network=resolve_subtensor_target(self.config),
            config=self.config,
        )
        logging.info(f"Subtensor: {self.subtensor}")

        # Initialize metagraph.
        self.metagraph = self.subtensor.metagraph(netuid=self.config.netuid)
        logging.info(f"Metagraph: {self.metagraph}")

        if self.wallet.hotkey.ss58_address not in self.metagraph.hotkeys:
            logging.error(
                f"\nYour miner: {self.wallet} is not registered to chain connection: {self.subtensor} \nRun 'btcli register' and try again."
            )
            exit()
        else:
            # Each miner gets a unique identity (UID) in the network.
            self.my_subnet_uid = self.metagraph.hotkeys.index(
                self.wallet.hotkey.ss58_address
            )
            logging.info(f"Running blue miner on uid: {self.my_subnet_uid}")

    # Shield implementation (commented out for mock testing)
    # def _load_shield(self) -> ShieldModel:
    #     logging.info(f"Loading shield model from: {self.model_path}")
    #     shield = ShieldModel(model_path=self.model_path)
    #     logging.info("Shield model ready")
    #     return shield

    # Shield implementation (commented out for mock testing)
    # def _load_seen_dangerous_prompt_keys(self) -> set[str]:
    #     if not os.path.exists(self.dangerous_prompts_path):
    #         return set()
    #
    #     with open(self.dangerous_prompts_path) as handle:
    #         entries = json.load(handle)
    #
    #     return {
    #         entry["prompt"]
    #         for entry in entries
    #         if isinstance(entry, dict) and entry.get("prompt")
    #     }

    # Shield implementation (commented out for mock testing)
    # def _read_dangerous_prompts(self) -> list[str]:
    #     if not os.path.exists(self.dangerous_prompts_path):
    #         return []
    #
    #     with open(self.dangerous_prompts_path) as handle:
    #         entries = json.load(handle)
    #
    #     return [
    #         entry["prompt"]
    #         for entry in entries
    #         if isinstance(entry, dict) and entry.get("prompt")
    #     ]

    # Shield implementation (commented out for mock testing)
    # def _maybe_fine_tune_shield(self):
    #     prompts = self._read_dangerous_prompts()
    #     new_prompts = [
    #         prompt for prompt in prompts if prompt not in self.seen_dangerous_prompt_keys
    #     ]
    #     if not new_prompts:
    #         return
    #
    #     if len(new_prompts) < self.fine_tune_threshold:
    #         logging.debug(
    #             f"Waiting for more dangerous prompts before fine-tuning "
    #             f"({len(new_prompts)}/{self.fine_tune_threshold})"
    #         )
    #         return
    #
    #     logging.info(
    #         f"Fine-tuning shield on {len(new_prompts)} new dangerous prompts"
    #     )
    #     self.shield.fine_tune_on_dangerous_prompts(new_prompts, epochs=3)
    #     self.shield.save(self.model_path)
    #     self.seen_dangerous_prompt_keys.update(new_prompts)
    #     logging.info("Shield fine-tuning complete")

    def _blacklist(self, synapse) -> Tuple[bool, str]:
        # Ignore requests from unrecognized entities.
        if synapse.dendrite.hotkey not in self.metagraph.hotkeys:
            logging.trace(f"Blacklisting unrecognized hotkey {synapse.dendrite.hotkey}")
            return True, "Unrecognized hotkey"
        logging.trace(f"Not blacklisting recognized hotkey {synapse.dendrite.hotkey}")
        return False, "Recognized hotkey"

    def blacklist_role_discovery(
        self, synapse: RoleDiscoverySynapse
    ) -> Tuple[bool, str]:
        return self._blacklist(synapse)

    def blacklist_blue_team(self, synapse: BlueTeamSynapse) -> Tuple[bool, str]:
        return self._blacklist(synapse)

    def discover_role(self, synapse: RoleDiscoverySynapse) -> RoleDiscoverySynapse:
        synapse.role = "blue"
        logging.info("Responded to role discovery: blue")
        return synapse

    def classify_prompts(self, synapse: BlueTeamSynapse) -> BlueTeamSynapse:
        # Shield implementation (commented out for mock testing)
        # synapse.classifications = self.shield.classify(synapse.prompts)
        # Mock classification
        synapse.classifications = get_mock_blue_classification(
            accuracy=self.accuracy, prompts=synapse.prompts
        )
        logging.info(
            f"Classified {len(synapse.prompts)} prompts: {synapse.classifications}"
        )
        return synapse

    def setup_axon(self):
        # Build and link miner functions to the axon.
        self.axon = Axon(wallet=self.wallet, config=self.config)

        # Attach functions to the axon.
        logging.info("Attaching forward functions to axon.")
        self.axon.attach(
            forward_fn=self.discover_role,
            blacklist_fn=self.blacklist_role_discovery,
        )
        self.axon.attach(
            forward_fn=self.classify_prompts,
            blacklist_fn=self.blacklist_blue_team,
        )

        # Start the axon server.
        logging.info(f"Starting axon server on port: {self.config.axon.port}")
        self.axon.start()

        # Register axon on the network.
        logging.info(
            f"Serving axon on network: {self.config.subtensor.network} with netuid: {self.config.netuid}"
        )
        self.subtensor.serve_axon(
            netuid=self.config.netuid,
            axon=self.axon,
            wait_for_finalization=True,
        )
        logging.info(f"Axon: {self.axon}")

    def _network_status_log(self) -> str:
        block = self.metagraph.block.item()
        incentive = "unavailable"
        if self.my_subnet_uid is not None:
            incentives = getattr(self.metagraph, "I", None)
            try:
                if incentives is not None and self.my_subnet_uid < len(incentives):
                    incentive = incentives[self.my_subnet_uid]
            except TypeError:
                incentive = "unavailable"

        return f"Block: {block} | Incentive: {incentive}"

    def run(self):
        self.setup_axon()

        # Keep the miner alive.
        logging.info("Blue miner starting main loop")
        step = 0
        while True:
            try:
                # Periodically update our knowledge of the network graph.
                if step % 60 == 0:
                    self.metagraph.sync()
                    logging.info(self._network_status_log())
                # Shield implementation (commented out for mock testing)
                # if step % self.model_poll_interval_sec == 0:
                #     self._maybe_fine_tune_shield()
                step += 1
                time.sleep(1)

            except KeyboardInterrupt:
                self.axon.stop()
                logging.success("Blue miner killed by keyboard interrupt.")
                break
            except Exception:
                logging.error(traceback.format_exc())
                continue


# Run the blue miner.
if __name__ == "__main__":
    miner = BlueMiner()
    miner.run()
