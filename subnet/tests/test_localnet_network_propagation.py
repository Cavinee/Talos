import unittest
from pathlib import Path


SUBNET_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SUBNET_DIR / "scripts" / "localnet"


class LocalnetNetworkPropagationTests(unittest.TestCase):
    def test_create_subnet_propagates_network_and_netuid_to_commit_reveal_disable(self):
        content = (SCRIPTS_DIR / "05_create_subnet.sh").read_text()

        self.assertIn(
            'NETUID="${NETUID}" NETWORK="${NETWORK}" python3 "${SCRIPT_DIR}/../../disable_commit_reveal.py"',
            content,
        )
        self.assertLess(
            content.index('subnet start --netuid "${NETUID}"'),
            content.index('disable_commit_reveal.py'),
        )

    def test_register_and_stake_uses_same_network_for_programmatic_staking(self):
        staking_script = (SCRIPTS_DIR / "07_stake_validators.sh").read_text()
        wrapper = (SCRIPTS_DIR / "06_register_and_stake.sh").read_text()

        self.assertIn('NETWORK="${NETWORK:-ws://127.0.0.1:9945}"', staking_script)
        self.assertIn('NETUID="${NETUID:-2}"', staking_script)
        self.assertIn('VALIDATOR_STAKE_AMOUNT="${VALIDATOR_STAKE_AMOUNT:-100}"', staking_script)
        self.assertIn('NETWORK="${NETWORK}"', staking_script)
        self.assertNotIn("NETWORK=local", staking_script)
        self.assertIn('"${SCRIPT_DIR}/07_stake_validators.sh"', wrapper)


if __name__ == "__main__":
    unittest.main()
