import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock


sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class RegisterSubnetNeuronTests(unittest.TestCase):
    def test_parse_retry_blocks_extracts_interval_wait(self):
        from register_subnet_neuron import parse_retry_blocks

        message = (
            "Subtensor returned `SubstrateRequestException(Invalid Transaction)` error. "
            "This means: `Custom error: 6 | Please consult https://docs.learnbittensor.org/errors/custom`.\n"
            "Registration to subnet 2 is full for this interval. Try again in 172 blocks."
        )

        self.assertEqual(172, parse_retry_blocks(message))

    def test_register_with_interval_retry_waits_for_next_block_window(self):
        from register_subnet_neuron import register_with_interval_retry

        subtensor = MagicMock()
        wallet = SimpleNamespace(name="test-wallet")
        subtensor.get_current_block.return_value = 100
        subtensor.burned_register.side_effect = [
            RuntimeError("Registration to subnet 2 is full for this interval. Try again in 172 blocks."),
            object(),
        ]

        result = register_with_interval_retry(
            subtensor=subtensor,
            wallet=wallet,
            netuid=2,
            max_attempts=3,
        )

        self.assertIsNotNone(result)
        self.assertEqual(2, subtensor.burned_register.call_count)
        subtensor.wait_for_block.assert_called_once_with(block=273)

    def test_register_with_interval_retry_reraises_non_interval_failures(self):
        from register_subnet_neuron import register_with_interval_retry

        subtensor = MagicMock()
        wallet = SimpleNamespace(name="test-wallet")
        subtensor.burned_register.side_effect = RuntimeError("Some other failure")

        with self.assertRaisesRegex(RuntimeError, "Some other failure"):
            register_with_interval_retry(
                subtensor=subtensor,
                wallet=wallet,
                netuid=2,
                max_attempts=2,
            )

    def test_calculate_next_interval_block_uses_adjustment_interval_boundary(self):
        from register_subnet_neuron import calculate_next_interval_block

        self.assertEqual(361, calculate_next_interval_block(current_block=188, adjustment_interval=172))

    def test_register_with_interval_retry_handles_generic_custom_error_6(self):
        from register_subnet_neuron import register_with_interval_retry

        subtensor = MagicMock()
        wallet = SimpleNamespace(name="test-wallet")
        subtensor.get_current_block.return_value = 188
        subtensor.get_subnet_hyperparameters.return_value = SimpleNamespace(adjustment_interval=172)
        subtensor.burned_register.side_effect = [
            RuntimeError("{'jsonrpc': '2.0', 'id': 'eY25', 'error': {'code': 1010, 'message': 'Invalid Transaction', 'data': 'Custom error: 6'}}"),
            object(),
        ]

        result = register_with_interval_retry(
            subtensor=subtensor,
            wallet=wallet,
            netuid=2,
            max_attempts=3,
        )

        self.assertIsNotNone(result)
        subtensor.get_subnet_hyperparameters.assert_called_once_with(2)
        subtensor.wait_for_block.assert_called_once_with(block=361)


if __name__ == "__main__":
    unittest.main()
