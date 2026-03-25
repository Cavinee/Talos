import sys
import unittest
from inspect import Parameter, Signature, signature
from pathlib import Path
from typing import Tuple

SUBNET_DIR = Path(__file__).resolve().parents[1]
if str(SUBNET_DIR) not in sys.path:
    sys.path.insert(0, str(SUBNET_DIR))

from blue_miner import BlueMiner
from protocol import BlueTeamSynapse, RedTeamSynapse, RoleDiscoverySynapse
from red_miner import RedMiner


def _expected_blacklist_signature(synapse_cls):
    return Signature(
        [
            Parameter(
                "synapse",
                kind=Parameter.POSITIONAL_OR_KEYWORD,
                annotation=synapse_cls,
            )
        ],
        return_annotation=Tuple[bool, str],
    )


class MinerSignatureCompatibilityTests(unittest.TestCase):
    def test_red_miner_blacklist_signatures_match_bittensor_expectation(self):
        miner = RedMiner.__new__(RedMiner)

        self.assertEqual(
            signature(miner.blacklist_role_discovery),
            _expected_blacklist_signature(RoleDiscoverySynapse),
        )
        self.assertEqual(
            signature(miner.blacklist_red_team),
            _expected_blacklist_signature(RedTeamSynapse),
        )

    def test_blue_miner_blacklist_signatures_match_bittensor_expectation(self):
        miner = BlueMiner.__new__(BlueMiner)

        self.assertEqual(
            signature(miner.blacklist_role_discovery),
            _expected_blacklist_signature(RoleDiscoverySynapse),
        )
        self.assertEqual(
            signature(miner.blacklist_blue_team),
            _expected_blacklist_signature(BlueTeamSynapse),
        )


if __name__ == "__main__":
    unittest.main()
