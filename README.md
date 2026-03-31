
# Talos Subnet

Adversarial prompt-injection testing on Bittensor. A red miner generates injection prompts, a blue miner classifies them, and a validator scores both and sets weights on-chain.

## Project Structure

```text
subnet/
├── red_miner.py                # Red-team miner (generates adversarial prompts)
├── blue_miner.py               # Blue-team miner (classifies prompts)
├── validator.py                # Validator (scores miners, sets weights)
├── protocol.py                 # Synapse definitions
├── disable_commit_reveal.py    # Utility to disable commit-reveal on localnet
└── scripts/localnet/           # Localnet setup and run scripts
```

## Prerequisites

- Docker
- Python 3.10+
- [Bittensor SDK](https://github.com/opentensor/bittensor) (`pip install bittensor`)
- `btcli` (comes with the SDK)

## Localnet Setup (Step by Step)

Activate your Python environment first:

```bash
cd subnet
source btsdk_venv/bin/activate
```

### Step 1: Pull the localnet image

```bash
docker pull ghcr.io/opentensor/subtensor-localnet:devnet-ready
```

### Step 2: Start the local chain

Run this in a **separate terminal** (it stays in the foreground):

```bash
docker run \
  --name local_chain \
  -p 9944:9944 \
  -p 9945:9945 \
  -v subtensor-local-data:/tmp \
  ghcr.io/opentensor/subtensor-localnet:devnet-ready
```

The volume mount persists chain state. To restart later:

```bash
docker stop local_chain && docker start local_chain
```

To start fresh, remove the container first:

```bash
docker stop local_chain && docker rm local_chain
docker volume rm subtensor-local-data
```

### Step 3: Create wallets

```bash
btcli wallet create --uri alice --wallet-name alice --hotkey default

btcli wallet create --wallet-name sn-creator --hotkey default

for i in {1..3}; do
  btcli wallet create --wallet-name test-validator-${i} --hotkey default
done

for i in {1..5}; do
  btcli wallet create --wallet-name test-red-miner-${i} --hotkey default
done

for i in {1..5}; do
  btcli wallet create --wallet-name test-blue-miner-${i} --hotkey default
done
```

### Step 4: Fund wallets

```bash
btcli wallet transfer --wallet-name alice --destination $(sed -nE 's/.*"ss58Address":"([^"]+)".*/\1/p' ~/.bittensor/wallets/sn-creator/coldkeypub.txt) --amount 1100 --network ws://127.0.0.1:9945

for i in {1..3}; do
  btcli wallet transfer --wallet-name alice --destination $(sed -nE 's/.*"ss58Address":"([^"]+)".*/\1/p' ~/.bittensor/wallets/test-validator-${i}/coldkeypub.txt) --amount 5000 --network ws://127.0.0.1:9945
done

for i in {1..5}; do
  btcli wallet transfer --wallet-name alice --destination $(sed -nE 's/.*"ss58Address":"([^"]+)".*/\1/p' ~/.bittensor/wallets/test-red-miner-${i}/coldkeypub.txt) --amount 50 --network ws://127.0.0.1:9945
done

for i in {1..5}; do
  btcli wallet transfer --wallet-name alice --destination $(sed -nE 's/.*"ss58Address":"([^"]+)".*/\1/p' ~/.bittensor/wallets/test-blue-miner-${i}/coldkeypub.txt) --amount 50 --network ws://127.0.0.1:9945
done
```

### Step 5: Create the subnet

```bash
btcli subnet create \
  --subnet-name talos \
  --wallet-name sn-creator \
  --hotkey default \
  --network ws://127.0.0.1:9945 \
  --no-mev-protection
```

### Step 6: Start the subnet

```bash
btcli subnet start --netuid 2 \
  --wallet-name sn-creator \
  --hotkey default \
  --network ws://127.0.0.1:9945
```

### Step 7: Disable commit-reveal

Commit-reveal uses Drand timelock encryption which does not work on localnet. Disable it on the started subnet using the Sudo pallet (the `alice` wallet holds the sudo key):

```bash
NETUID=2 NETWORK=ws://127.0.0.1:9945 python disable_commit_reveal.py
```

If you skip this step, the validator will successfully commit weights but they will never be revealed, resulting in zero miner emissions.

### Step 8: Register neurons and stake

You can run the phases separately:

```bash
./scripts/localnet/06_register_neurons.sh
./scripts/localnet/07_stake_validators.sh
```

If you prefer a single command, `./scripts/localnet/06_register_and_stake.sh` remains available as a convenience wrapper.

The registration script retries automatically when the subnet is full for the current interval, then the staking script stakes the three validators once all registrations succeed.

### Step 9: Run the miners and validator

Run each process in its own terminal, or use the convenience launcher at the end of this section.

**Red miners (5 terminals):**

```bash
./scripts/localnet/07_run_red_miner.sh 1
./scripts/localnet/07_run_red_miner.sh 2
./scripts/localnet/07_run_red_miner.sh 3
./scripts/localnet/07_run_red_miner.sh 4
./scripts/localnet/07_run_red_miner.sh 5
```

**Blue miners (5 terminals):**

```bash
./scripts/localnet/08_run_blue_miner.sh 1
./scripts/localnet/08_run_blue_miner.sh 2
./scripts/localnet/08_run_blue_miner.sh 3
./scripts/localnet/08_run_blue_miner.sh 4
./scripts/localnet/08_run_blue_miner.sh 5
```

**Validators (3 terminals):**

```bash
./scripts/localnet/09_run_validator.sh 1
./scripts/localnet/09_run_validator.sh 2
./scripts/localnet/09_run_validator.sh 3
```

**Launch all 13 processes at once:**

```bash
./scripts/localnet/10_run_all.sh
```

### Step 10: Check emissions

Wait 2-3 minutes for the first tempo to complete, then:

```bash
btcli wallet overview --subtensor.network local --netuid 2
```

You should see non-zero `Incentive` and `Emissions` for the miner UIDs.

## Copy-Paste Runbook

For a fresh coworker setup, set `REPO_ROOT` to the local checkout once in each terminal and then use the script blocks below as-is.

**Shared setup for every terminal**

```bash
export REPO_ROOT="/path/to/Talos"
cd "$REPO_ROOT/subnet"
source btsdk_venv/bin/activate
```

**Terminal 0: pull the localnet image**

```bash
export REPO_ROOT="/path/to/Talos"
cd "$REPO_ROOT/subnet"
source btsdk_venv/bin/activate
./scripts/localnet/01_pull_image.sh
```

**Terminal 1: start the local chain**

```bash
export REPO_ROOT="/path/to/Talos"
cd "$REPO_ROOT/subnet"
source btsdk_venv/bin/activate
./scripts/localnet/02_start_chain.sh
```

**Terminal 2: create wallets, fund, create subnet, register, and stake**

```bash
export REPO_ROOT="/path/to/Talos"
cd "$REPO_ROOT/subnet"
source btsdk_venv/bin/activate
./scripts/localnet/03_create_wallets.sh
./scripts/localnet/04_fund_wallets.sh
./scripts/localnet/05_create_subnet.sh
./scripts/localnet/06_register_neurons.sh
./scripts/localnet/07_stake_validators.sh
```

If you want the combined convenience path instead, replace the last two commands with `./scripts/localnet/06_register_and_stake.sh`.

**Terminal 3: launch all 13 miners and validators**

```bash
export REPO_ROOT="/path/to/Talos"
cd "$REPO_ROOT/subnet"
source btsdk_venv/bin/activate
./scripts/localnet/10_run_all.sh
```

If you prefer to launch nodes individually instead, use the per-index commands from Step 9 rather than mixing them with `10_run_all.sh`.

## Automated Bootstrap

Alternatively, run all setup steps (3-8) with a single script:

```bash
export REPO_ROOT="/path/to/Talos"
cd "$REPO_ROOT/subnet"
source btsdk_venv/bin/activate
./scripts/localnet/bootstrap_localnet.sh
```

This will prompt you to start the chain in a separate terminal, then run wallet creation, funding, subnet creation, commit-reveal disable, neuron registration, and validator staking automatically.

To launch all 13 registered nodes after bootstrapping:

```bash
export REPO_ROOT="/path/to/Talos"
cd "$REPO_ROOT/subnet"
source btsdk_venv/bin/activate
./scripts/localnet/10_run_all.sh
```

## Restarting

If you used the volume mount in Step 2, chain state persists across restarts:

```bash
docker stop local_chain && docker start local_chain
```

No need to re-run Steps 3-8. Just start the miners and validators again (Step 9).

## Notes

- **Commit-reveal on localnet**: Must be disabled (Step 7). The Drand timelock oracle is not reachable from local chains, so committed weights are never revealed.
- **Tempo**: Localnet uses a 10-block tempo (~2 minutes per epoch). Emissions update at each tempo boundary.
- **Validator runtime**: Each validator process runs 10 evaluation epochs, sets weights, and exits. Re-run `./scripts/localnet/09_run_validator.sh <INDEX>` or `./scripts/localnet/10_run_all.sh` when you want another scoring pass.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
