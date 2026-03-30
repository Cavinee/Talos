import argparse
import os
import time
import traceback
from typing import Tuple

from bittensor import Subtensor, Config, Axon
from bittensor.utils.btlogging import logging
from bittensor_wallet import Wallet

from bittensor_network import resolve_subtensor_target
from protocol import RoleDiscoverySynapse, RedTeamSynapse
# from llm_client import LLMClient  # LLM implementation (commented out for mock testing)
from mock_data import RED_MINER_SKILLS, get_mock_red_prompts


class RedMiner:
    def __init__(self):
        self.subtensor = None
        self.wallet = None
        self.metagraph = None
        self.axon = None
        self.my_subnet_uid = None

        self.config = self.get_config()
        self.setup_logging()
        self.setup_bittensor_objects()
        # self.llm = LLMClient()  # LLM implementation (commented out for mock testing)
        self.skill_level = RED_MINER_SKILLS.get(self.config.miner_index, 0.5)

    def get_config(self):
        # Set up the configuration parser
        parser = argparse.ArgumentParser()
        # Adds override arguments for network and netuid.
        parser.add_argument(
            "--netuid", type=int, default=1, help="The chain subnet uid."
        )
        # Adds miner index for skill level lookup.
        parser.add_argument(
            "--miner-index", type=int, default=1, help="Miner index (1-5) for skill level lookup."
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
                "red_miner",
            )
        )
        # Ensure the directory for logging exists.
        os.makedirs(config.full_path, exist_ok=True)
        return config

    def setup_logging(self):
        # Activate Bittensor's logging with the set configurations.
        logging(config=self.config, logging_dir=self.config.full_path)
        logging.info(f"Running red miner for subnet: {self.config.netuid}")
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
            logging.info(f"Running red miner on uid: {self.my_subnet_uid}")

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

    def blacklist_red_team(self, synapse: RedTeamSynapse) -> Tuple[bool, str]:
        return self._blacklist(synapse)

    def discover_role(self, synapse: RoleDiscoverySynapse) -> RoleDiscoverySynapse:
        synapse.role = "red"
        logging.info("Responded to role discovery: red")
        return synapse

    def generate_prompts(self, synapse: RedTeamSynapse) -> RedTeamSynapse:
        # prompts = self.llm.generate_adversarial_prompts(  # LLM implementation (commented out for mock testing)
        #     system_prompt=synapse.system_prompt,
        #     category=synapse.target_category,
        # )
        prompts = get_mock_red_prompts(
            skill_level=self.skill_level,
            category=synapse.target_category,
        )
        synapse.prompts = prompts
        logging.info(
            f"Generated {len(prompts)} prompts for category: {synapse.target_category}"
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
            forward_fn=self.generate_prompts,
            blacklist_fn=self.blacklist_red_team,
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
        logging.info("Red miner starting main loop")
        step = 0
        while True:
            try:
                # Periodically update our knowledge of the network graph.
                if step % 60 == 0:
                    self.metagraph.sync()
                    logging.info(self._network_status_log())
                step += 1
                time.sleep(1)

            except KeyboardInterrupt:
                self.axon.stop()
                logging.success("Red miner killed by keyboard interrupt.")
                break
            except Exception:
                logging.error(traceback.format_exc())
                continue


# Run the red miner.
if __name__ == "__main__":
    miner = RedMiner()
    miner.run()
