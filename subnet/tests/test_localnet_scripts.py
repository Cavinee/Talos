import os
import subprocess
import unittest
from tempfile import TemporaryDirectory
from pathlib import Path
import os
import shutil
import stat
import subprocess
import tempfile


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
            "06_register_neurons.sh",
            "06_register_and_stake.sh",
            "07_stake_validators.sh",
            "07_run_red_miner.sh",
            "08_run_blue_miner.sh",
            "09_run_validator.sh",
            "10_run_all.sh",
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
            "10_run_all.sh",
        ]:
            self.assertIn(script_name, bootstrap)

        self.assertIn("07_run_red_miner.sh 1", bootstrap)
        self.assertIn("08_run_blue_miner.sh 1", bootstrap)
        self.assertIn("09_run_validator.sh 3", bootstrap)

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
                "for i in {1..3}; do",
                "--wallet-name test-validator-${i}",
                "for i in {1..5}; do",
                "--wallet-name test-red-miner-${i}",
                "--wallet-name test-blue-miner-${i}",
            ],
            "04_fund_wallets.sh": [
                "--wallet-name alice",
                'NETWORK="${NETWORK:-ws://127.0.0.1:9945}"',
                'VALIDATOR_TAO="${VALIDATOR_TAO:-5000}"',
                'MINER_TAO="${MINER_TAO:-50}"',
                "--amount",
                "1100",
                "test-validator-${i}",
                "test-red-miner-${i}",
                "test-blue-miner-${i}",
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
            "06_register_neurons.sh": [
                'NETUID="${NETUID:-2}"',
                "register_wallet()",
                'WALLET_NAME="${wallet_name}"',
                "register_subnet_neuron.py",
                'register_wallet "test-validator-${i}"',
                'register_wallet "test-red-miner-${i}"',
                'register_wallet "test-blue-miner-${i}"',
            ],
            "07_stake_validators.sh": [
                "stake_validator.py",
                'NETWORK="${NETWORK}"',
                'STAKE_PER_ROUND="${VALIDATOR_STAKE_AMOUNT}"',
                'WALLET_NAME="test-validator-${i}"',
            ],
            "06_register_and_stake.sh": [
                '"${SCRIPT_DIR}/06_register_neurons.sh"',
                '"${SCRIPT_DIR}/07_stake_validators.sh"',
                "SCRIPT_DIR=",
            ],
            "07_run_red_miner.sh": [
                'PYTHON_BIN="${PYTHON_BIN:-python}"',
                'echo "Usage: $0 <INDEX>"',
                "red_miner.py",
                "--wallet.name test-red-miner-${INDEX}",
                "--wallet.hotkey default",
                "--subtensor.network local",
                "--netuid 2",
                "PORT=$((8090 + INDEX))",
                '--axon.port "${PORT}"',
                '--miner-index "${INDEX}"',
            ],
            "08_run_blue_miner.sh": [
                'PYTHON_BIN="${PYTHON_BIN:-python}"',
                'echo "Usage: $0 <INDEX>"',
                "blue_miner.py",
                "--wallet.name test-blue-miner-${INDEX}",
                "--wallet.hotkey default",
                "--subtensor.network local",
                "--netuid 2",
                "PORT=$((8095 + INDEX))",
                '--axon.port "${PORT}"',
                '--miner-index "${INDEX}"',
            ],
            "09_run_validator.sh": [
                'PYTHON_BIN="${PYTHON_BIN:-python}"',
                'echo "Usage: $0 <INDEX>"',
                "validator.py",
                "--wallet.name test-validator-${INDEX}",
                "--wallet.hotkey default",
                "--subtensor.network local",
                "--netuid 2",
                "--logging.debug",
            ],
            "10_run_all.sh": [
                "Launching 13 processes",
                "for i in {1..5}; do",
                '"${SCRIPT_DIR}/07_run_red_miner.sh" "$i" &',
                '"${SCRIPT_DIR}/08_run_blue_miner.sh" "$i" &',
                "for i in {1..3}; do",
                '"${SCRIPT_DIR}/09_run_validator.sh" "$i" &',
            ],
        }

        for script_name, snippets in expected_snippets.items():
            content = (SCRIPTS_DIR / script_name).read_text()
            for snippet in snippets:
                with self.subTest(script=script_name, snippet=snippet):
                    self.assertIn(snippet, content)

    def test_wrapper_only_orchestrates_split_scripts(self):
        wrapper = (SCRIPTS_DIR / "06_register_and_stake.sh").read_text()

        self.assertIn('SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"', wrapper)
        self.assertIn('"${SCRIPT_DIR}/06_register_neurons.sh"', wrapper)
        self.assertIn('"${SCRIPT_DIR}/07_stake_validators.sh"', wrapper)
        self.assertNotIn("register_wallet()", wrapper)
        self.assertNotIn("register_subnet_neuron.py", wrapper)
        self.assertNotIn("stake_validator.py", wrapper)

    def test_wrapper_runs_registration_before_staking(self):
        wrapper_source = (SCRIPTS_DIR / "06_register_and_stake.sh").read_text()

        with TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            log_file = tmp_path / "execution-order.log"
            wrapper_path = tmp_path / "06_register_and_stake.sh"
            register_script = tmp_path / "06_register_neurons.sh"
            stake_script = tmp_path / "07_stake_validators.sh"

            def write_executable(path, content):
                path.write_text(content)
                path.chmod(0o755)

            write_executable(wrapper_path, wrapper_source)
            write_executable(
                register_script,
                """#!/usr/bin/env bash
set -euo pipefail

printf '%s\\n' registration >> "${LOG_FILE}"
""",
            )
            write_executable(
                stake_script,
                """#!/usr/bin/env bash
set -euo pipefail

printf '%s\\n' staking >> "${LOG_FILE}"
""",
            )

            env = os.environ.copy()
            env["LOG_FILE"] = str(log_file)

            subprocess.run([str(wrapper_path)], check=True, cwd=tmp_path, env=env)

            self.assertEqual(["registration", "staking"], log_file.read_text().splitlines())

    def test_readme_documents_scripted_localnet_flow(self):
        readme = README_PATH.read_text()

        self.assertIn("## Localnet Setup (Step by Step)", readme)
        self.assertIn("## Copy-Paste Runbook", readme)
        self.assertIn("REPO_ROOT=", readme)
        self.assertIn("./scripts/localnet/03_create_wallets.sh", readme)
        self.assertIn("./scripts/localnet/02_start_chain.sh", readme)
        self.assertIn("./scripts/localnet/05_create_subnet.sh", readme)
        self.assertIn("./scripts/localnet/07_run_red_miner.sh 1", readme)
        self.assertIn("./scripts/localnet/08_run_blue_miner.sh 1", readme)
        self.assertIn("./scripts/localnet/09_run_validator.sh 1", readme)
        self.assertIn("./scripts/localnet/10_run_all.sh", readme)
        self.assertIn("commit-reveal", readme)
        self.assertNotIn("/Users/cavine/Code/Talos", readme)

    def test_worktree_launch_scripts_fall_back_when_python_bin_points_to_missing_venv(self):
        script_names = [
            "07_run_red_miner.sh",
            "08_run_blue_miner.sh",
            "09_run_validator.sh",
        ]

        with tempfile.TemporaryDirectory() as temp_dir:
            repo_root = Path(temp_dir) / "Talos"
            primary_subnet_dir = repo_root / "subnet"
            worktree_subnet_dir = repo_root / ".worktrees" / "feature" / "subnet"
            worktree_scripts_dir = worktree_subnet_dir / "scripts" / "localnet"
            shared_python = primary_subnet_dir / "btsdk_venv" / "bin" / "python"
            output_path = repo_root / "resolved-python.txt"

            worktree_scripts_dir.mkdir(parents=True)
            shared_python.parent.mkdir(parents=True)

            shared_python.write_text(
                "#!/usr/bin/env bash\n"
                "printf '%s\\n' \"$0\" > \"$TEST_OUTPUT\"\n"
                "printf '%s\\n' \"$@\" >> \"$TEST_OUTPUT\"\n"
            )
            shared_python.chmod(shared_python.stat().st_mode | stat.S_IEXEC)

            script_targets = {
                "07_run_red_miner.sh": "red_miner.py",
                "08_run_blue_miner.sh": "blue_miner.py",
                "09_run_validator.sh": "validator.py",
            }

            for script_name in script_names:
                shutil.copy2(SCRIPTS_DIR / script_name, worktree_scripts_dir / script_name)
                (worktree_subnet_dir / script_targets[script_name]).write_text(
                    "print('placeholder')\n"
                )

            for script_name, entrypoint in script_targets.items():
                with self.subTest(script=script_name):
                    output_path.unlink(missing_ok=True)
                    invalid_python = (
                        worktree_subnet_dir / "btsdk_venv" / "bin" / "python"
                    )
                    env = os.environ.copy()
                    env["PYTHON_BIN"] = str(invalid_python)
                    env["TEST_OUTPUT"] = str(output_path)

                    completed = subprocess.run(
                        ["bash", str(worktree_scripts_dir / script_name)],
                        check=False,
                        cwd=repo_root / ".worktrees" / "feature",
                        env=env,
                        capture_output=True,
                        text=True,
                    )

                    self.assertEqual(
                        completed.returncode,
                        0,
                        msg=f"{script_name} should recover from a stale PYTHON_BIN override. stderr={completed.stderr}",
                    )
                    resolved_output = output_path.read_text()
                    self.assertIn(str(shared_python), resolved_output)
                    self.assertIn(entrypoint, resolved_output)


if __name__ == "__main__":
    unittest.main()
