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
        content = (SCRIPTS_DIR / "06_register_and_stake.sh").read_text()

        self.assertIn('NETWORK="${NETWORK}"', content)
        self.assertNotIn("NETWORK=local", content)


if __name__ == "__main__":
    unittest.main()
