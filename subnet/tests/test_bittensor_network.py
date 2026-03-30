import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace


SUBNET_DIR = Path(__file__).resolve().parents[1]
MODULE_PATH = SUBNET_DIR / "bittensor_network.py"


def load_module():
    if not MODULE_PATH.exists():
        return None

    spec = importlib.util.spec_from_file_location("bittensor_network", MODULE_PATH)
    if spec is None or spec.loader is None:
        return None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class BittensorNetworkTests(unittest.TestCase):
    def test_explicit_chain_endpoint_takes_precedence_over_default_network(self):
        module = load_module()
        self.assertIsNotNone(module, "Expected subnet/bittensor_network.py to exist.")

        config = SimpleNamespace(
            subtensor=SimpleNamespace(
                chain_endpoint="ws://127.0.0.1:9945",
                network="finney",
            )
        )

        self.assertEqual(
            "ws://127.0.0.1:9945",
            module.resolve_subtensor_target(config),
        )

    def test_network_is_used_when_chain_endpoint_is_missing(self):
        module = load_module()
        self.assertIsNotNone(module, "Expected subnet/bittensor_network.py to exist.")

        config = SimpleNamespace(
            subtensor=SimpleNamespace(
                chain_endpoint="",
                network="local",
            )
        )

        self.assertEqual("local", module.resolve_subtensor_target(config))


if __name__ == "__main__":
    unittest.main()
