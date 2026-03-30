import importlib
import json
import sys
import tempfile
import threading
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


SUBNET_DIR = Path(__file__).resolve().parents[1]
README_PATH = SUBNET_DIR / "README.md"


def import_validator_with_stubs():
    for module_name in [
        "validator",
        "protocol",
        "bittensor",
        "bittensor.utils",
        "bittensor.utils.btlogging",
        "bittensor_wallet",
    ]:
        sys.modules.pop(module_name, None)

    bittensor = types.ModuleType("bittensor")

    class Synapse:
        pass

    class Subtensor:
        @staticmethod
        def add_args(parser):
            return None

    class Config:
        def __init__(self, parser):
            self.logging = SimpleNamespace(logging_dir="/tmp")
            self.wallet = SimpleNamespace(name="test-validator", hotkey="default")
            self.netuid = 2
            self.subtensor = SimpleNamespace(network="local")

    class Dendrite:
        def __init__(self, wallet=None):
            self.wallet = wallet

    bittensor.Synapse = Synapse
    bittensor.Subtensor = Subtensor
    bittensor.Config = Config
    bittensor.Dendrite = Dendrite

    btlogging = types.ModuleType("bittensor.utils.btlogging")

    class DummyLogging:
        @staticmethod
        def add_args(parser):
            return None

        @staticmethod
        def info(*args, **kwargs):
            return None

        @staticmethod
        def error(*args, **kwargs):
            return None

        @staticmethod
        def warning(*args, **kwargs):
            return None

        @staticmethod
        def success(*args, **kwargs):
            return None

    btlogging.logging = DummyLogging

    bittensor_utils = types.ModuleType("bittensor.utils")
    bittensor_utils.btlogging = btlogging

    bittensor_wallet = types.ModuleType("bittensor_wallet")

    class Wallet:
        @staticmethod
        def add_args(parser):
            return None

        def __init__(self, config=None, name=None):
            self.name = name or "test-validator"
            self.hotkey = SimpleNamespace(ss58_address=f"{self.name}-hotkey")
            self.coldkey = SimpleNamespace(ss58_address=f"{self.name}-coldkey")

    bittensor_wallet.Wallet = Wallet

    protocol = types.ModuleType("protocol")

    class RoleDiscoverySynapse:
        def __init__(self, role=None):
            self.role = role

    class RedTeamSynapse:
        def __init__(self, system_prompt=None, target_category=None, prompts=None):
            self.system_prompt = system_prompt
            self.target_category = target_category
            self.prompts = prompts

    class BlueTeamSynapse:
        def __init__(self, prompts=None, classifications=None):
            self.prompts = prompts
            self.classifications = classifications

    protocol.RoleDiscoverySynapse = RoleDiscoverySynapse
    protocol.RedTeamSynapse = RedTeamSynapse
    protocol.BlueTeamSynapse = BlueTeamSynapse

    sys.modules["bittensor"] = bittensor
    sys.modules["bittensor.utils"] = bittensor_utils
    sys.modules["bittensor.utils.btlogging"] = btlogging
    sys.modules["bittensor_wallet"] = bittensor_wallet
    sys.modules["protocol"] = protocol

    if str(SUBNET_DIR) not in sys.path:
        sys.path.insert(0, str(SUBNET_DIR))

    return importlib.import_module("validator")


class LocalnetTopologyRegressionTests(unittest.TestCase):
    def test_mock_red_prompts_vary_by_skill_level_for_attack_categories(self):
        from mock_data import get_mock_red_prompts, mock_judge_output

        high_skill_prompts = get_mock_red_prompts(
            skill_level=0.9,
            category="jailbreak",
            count=20,
            seed=123,
        )
        low_skill_prompts = get_mock_red_prompts(
            skill_level=0.1,
            category="jailbreak",
            count=20,
            seed=123,
        )

        high_skill_dangerous = sum(mock_judge_output(prompt) for prompt in high_skill_prompts)
        low_skill_dangerous = sum(mock_judge_output(prompt) for prompt in low_skill_prompts)

        self.assertGreater(high_skill_dangerous, low_skill_dangerous)
        self.assertLess(low_skill_dangerous, len(low_skill_prompts))

    def test_validator_waits_for_full_miner_set_before_scoring(self):
        validator_module = import_validator_with_stubs()
        validator = validator_module.Validator.__new__(validator_module.Validator)

        validator.config = SimpleNamespace(netuid=2)
        validator.metagraph = SimpleNamespace(sync=MagicMock())
        validator.subtensor = SimpleNamespace(set_weights=MagicMock(return_value=(True, "ok")))
        validator.wallet = object()
        validator.minimum_red_miners = 5
        validator.minimum_blue_miners = 5
        validator.role_discovery_max_attempts = 2
        validator.role_discovery_poll_interval = 0
        validator.run_epoch = MagicMock(return_value=(1.0, 1.0, 1.0, 1.0))
        validator.discover_roles = MagicMock(
            side_effect=[
                {0: "red", 5: "blue"},
                {
                    0: "red",
                    1: "red",
                    2: "red",
                    3: "red",
                    4: "red",
                    5: "blue",
                    6: "blue",
                    7: "blue",
                    8: "blue",
                    9: "blue",
                },
            ]
        )

        with patch.object(validator_module, "NUM_EPOCHS", 1):
            validator.run()

        self.assertGreaterEqual(validator.discover_roles.call_count, 2)
        set_weights_kwargs = validator.subtensor.set_weights.call_args.kwargs
        self.assertEqual(10, len(set_weights_kwargs["uids"]))

    def test_validator_assigns_positive_weight_to_every_discovered_miner(self):
        validator_module = import_validator_with_stubs()
        validator = validator_module.Validator.__new__(validator_module.Validator)

        role_map = {
            0: "red",
            1: "red",
            2: "red",
            3: "red",
            4: "red",
            5: "blue",
            6: "blue",
            7: "blue",
            8: "blue",
            9: "blue",
        }

        validator.config = SimpleNamespace(netuid=2)
        validator.metagraph = SimpleNamespace(sync=MagicMock())
        validator.subtensor = SimpleNamespace(set_weights=MagicMock(return_value=(True, "ok")))
        validator.wallet = object()
        validator.minimum_red_miners = 5
        validator.minimum_blue_miners = 5
        validator.role_discovery_max_attempts = 1
        validator.role_discovery_poll_interval = 0
        validator.discover_roles = MagicMock(return_value=role_map)
        validator.run_epoch = MagicMock(return_value=(1.0, 1.0, 1.0, 1.0))

        with patch.object(validator_module, "NUM_EPOCHS", 10), patch.object(
            validator_module.random,
            "choice",
            side_effect=lambda seq: seq[0],
        ):
            validator.run()

        weights = validator.subtensor.set_weights.call_args.kwargs["weights"]
        self.assertEqual(10, len(weights))
        self.assertTrue(all(weight > 0 for weight in weights))

    def test_append_dangerous_entries_preserves_all_concurrent_writes(self):
        validator_module = import_validator_with_stubs()
        append_entries = validator_module.append_dangerous_entries

        with tempfile.TemporaryDirectory() as temp_dir:
            json_path = Path(temp_dir) / "dangerous_prompts.json"
            threads = []

            for index in range(10):
                entries = [
                    {
                        "round": 1,
                        "category": "jailbreak",
                        "prompt": f"prompt-{index}",
                        "output": None,
                    }
                ]
                thread = threading.Thread(
                    target=append_entries,
                    args=(json_path, entries),
                )
                threads.append(thread)

            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()

            stored_entries = json.loads(json_path.read_text())

        self.assertEqual(10, len(stored_entries))
        self.assertEqual(
            {f"prompt-{index}" for index in range(10)},
            {entry["prompt"] for entry in stored_entries},
        )

    def test_readme_does_not_tell_users_to_launch_remaining_nodes_with_all_in_one_script(self):
        readme = README_PATH.read_text()

        self.assertNotIn("launch the remaining nodes", readme)


if __name__ == "__main__":
    unittest.main()
