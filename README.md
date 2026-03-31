# Talos Subnet

Adversarial prompt-injection testing on Bittensor. A red miner generates injection prompts, a blue miner classifies them, and a validator scores both and sets weights on-chain.

## Screenshots

### Threat Dashboard

![Threat Dashboard](frontend/public/images/threat-dashboard.png)

### Campaign Operations

![Campaign Operations](frontend/public/images/campaign-operations.png)

### Testnet Subnet Overview

![Testnet Subnet Overview](frontend/public/images/subnet-table.png)

## Project Structure

```text
subnet/
├── red_miner.py                # Red-team miner (generates adversarial prompts)
├── blue_miner.py               # Blue-team miner (classifies prompts)
├── validator.py                # Validator (scores miners, sets weights)
├── protocol.py                 # Synapse definitions
└── scripts/testnet/            # Testnet setup and run scripts
```

## Prerequisites

- Python 3.10+
- [Bittensor SDK](https://github.com/opentensor/bittensor) (`pip install bittensor`)
- `btcli` (comes with the SDK)
- An OpenRouter API key (used by miners for LLM inference)

## Testnet Setup

Activate your Python environment first:

```bash
cd subnet
source btsdk_venv/bin/activate
```

### Step 1: Create wallets

```bash
./scripts/testnet/00_create_wallets.sh
```

### Step 2: Fund wallets

Fund wallets with testnet TAO. You can get testnet TAO from the Bittensor testnet faucet.

```bash
./scripts/testnet/00_fund_wallets.sh
```

### Step 3: Register neurons

```bash
./scripts/testnet/00_register_neurons.sh
```

### Step 4: Configure subnet hyperparameters

```bash
./scripts/testnet/00_configure_subnet.sh
```

### Step 5: Stake validators

```bash
./scripts/testnet/05_stake_validators.sh
```

### Step 6: Run the miners and validator

Run each process in its own terminal, or use the convenience launcher.

**Red miner:**

```bash
./scripts/testnet/01_run_red_miner.sh 1
```

**Blue miner:**

```bash
./scripts/testnet/02_run_blue_miner.sh 1
```

**Validator:**

```bash
./scripts/testnet/03_run_validator.sh 1
```

**Launch all 3 processes at once:**

```bash
./scripts/testnet/04_run_all.sh
```

### Step 7: Check emissions

Wait 2-3 minutes for the first tempo to complete, then:

```bash
btcli wallet overview --subtensor.network test --netuid <your-netuid>
```

You should see non-zero `Incentive` and `Emissions` for the miner UIDs.

## Known Limitations

- **Topology**: The design goal is 3 validators + 5 red miners + 5 blue miners (13 processes). Currently limited to **1 validator + 1 red miner + 1 blue miner** due to 429 rate-limiting errors from the LLM API when running the full topology concurrently.
- **Validator staking**: Validators cannot currently be staked on the testnet subnet.

## Notes

- **Testnet endpoint**: All scripts connect to `wss://test.finney.opentensor.ai:443`.
- **Validator runtime**: Each validator process runs 10 evaluation epochs, sets weights, and exits. Re-run the validator script when you want another scoring pass.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
