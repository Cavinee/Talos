import unittest
from pathlib import Path


SUBNET_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SUBNET_DIR / "scripts" / "localnet"
README_PATH = SUBNET_DIR / "README.md"


class LocalnetScriptsTests(unittest.TestCase):
    def test_expected_localnet_scripts_exist(self):
        expected = {
            "bootstrap_localnet.sh",
            "01_pull_image.sh",
            "02_start_chain.sh",
            "03_create_wallets.sh",
            "04_fund_wallets.sh",
            "05_create_subnet.sh",
            "06_register_and_stake.sh",
            "07_run_red_miner.sh",
            "08_run_blue_miner.sh",
            "09_run_validator.sh",
        }

        self.assertTrue(SCRIPTS_DIR.is_dir(), "scripts/localnet directory is missing")
        self.assertEqual(expected, {path.name for path in SCRIPTS_DIR.iterdir() if path.is_file()})

    def test_bootstrap_script_references_phase_scripts(self):
        bootstrap = (SCRIPTS_DIR / "bootstrap_localnet.sh").read_text()

        for script_name in [
            "01_pull_image.sh",
            "03_create_wallets.sh",
            "04_fund_wallets.sh",
            "05_create_subnet.sh",
            "06_register_and_stake.sh",
        ]:
            self.assertIn(script_name, bootstrap)

    def test_phase_scripts_include_requested_commands(self):
        expected_snippets = {
            "01_pull_image.sh": [
                "docker pull ghcr.io/opentensor/subtensor-localnet:devnet-ready",
            ],
            "02_start_chain.sh": [
                "docker run",
                "--name local_chain",
                "-p 9944:9944",
                "-p 9945:9945",
                "-v subtensor-local-data:/tmp",
                "ghcr.io/opentensor/subtensor-localnet:devnet-ready",
            ],
            "03_create_wallets.sh": [
                "wallet create --uri alice",
                "--wallet-name sn-creator",
                "--wallet-name test-validator",
                "--wallet-name test-blue-miner",
                "--wallet-name test-red-miner",
            ],
            "04_fund_wallets.sh": [
                "--wallet-name alice",
                'NETWORK="${NETWORK:-ws://127.0.0.1:9945}"',
                "--amount",
                "1100",
                "100",
                "50",
            ],
            "05_create_subnet.sh": [
                "subnet create",
                "--subnet-name talos",
                "--wallet-name sn-creator",
                "--hotkey default",
                'NETWORK="${NETWORK:-ws://127.0.0.1:9945}"',
                "--no-mev-protection",
                'NETUID="${NETUID:-2}"',
                "subnet start --netuid",
                'NETUID="${NETUID}" NETWORK="${NETWORK}" python3 "${SCRIPT_DIR}/../../disable_commit_reveal.py"',
            ],
            "06_register_and_stake.sh": [
                'NETUID="${NETUID:-2}"',
                "subnets register --netuid",
                "--wallet-name test-validator",
                "--hotkey default",
                "--wallet-name test-red-miner",
                "--wallet-name test-blue-miner",
                "stake_validator.py",
                'NETWORK="${NETWORK}"',
                'STAKE_PER_ROUND="${VALIDATOR_STAKE_AMOUNT}"',
            ],
            "07_run_red_miner.sh": [
                'PYTHON_BIN="${PYTHON_BIN:-python}"',
                "red_miner.py",
                "--wallet.name test-red-miner",
                "--wallet.hotkey default",
                "--subtensor.network local",
                "--netuid 2",
                "--axon.port 8091",
            ],
            "08_run_blue_miner.sh": [
                'PYTHON_BIN="${PYTHON_BIN:-python}"',
                "blue_miner.py",
                "--wallet.name test-blue-miner",
                "--wallet.hotkey default",
                "--subtensor.network local",
                "--netuid 2",
                "--axon.port 8092",
            ],
            "09_run_validator.sh": [
                'PYTHON_BIN="${PYTHON_BIN:-python}"',
                "validator.py",
                "--wallet.name test-validator",
                "--wallet.hotkey default",
                "--subtensor.network local",
                "--netuid 2",
                "--logging.debug",
            ],
        }

        for script_name, snippets in expected_snippets.items():
            content = (SCRIPTS_DIR / script_name).read_text()
            for snippet in snippets:
                with self.subTest(script=script_name, snippet=snippet):
                    self.assertIn(snippet, content)

    def test_readme_documents_scripted_localnet_flow(self):
        readme = README_PATH.read_text()

        self.assertIn("## Localnet Setup (Step by Step)", readme)
        self.assertIn("## Copy-Paste Runbook", readme)
        self.assertIn("REPO_ROOT=", readme)
        self.assertIn("./scripts/localnet/03_create_wallets.sh", readme)
        self.assertIn("./scripts/localnet/02_start_chain.sh", readme)
        self.assertIn("./scripts/localnet/05_create_subnet.sh", readme)
        self.assertIn("./scripts/localnet/09_run_validator.sh", readme)
        self.assertIn("commit-reveal", readme)
        self.assertNotIn("/Users/cavine/Code/Talos", readme)


if __name__ == "__main__":
    unittest.main()
