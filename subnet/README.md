# Talos Subnet

Adversarial AI security testing subnet on Bittensor. Red team miners generate prompt injections, blue team miners defend against them.

## Prerequisites

- Python 3.10+
- Docker (for local subtensor)

## Local Subtensor Setup

```bash
docker run -d --name subtensor -p 9944:9944 -p 9933:9933 -p 30333:30333 \
  opentensor/subtensor:latest \
  --dev --rpc-external --rpc-cors all
```

## Install Dependencies

```bash
pip install -r requirements.txt
```

## Create Wallets

```bash
btcli wallet create --wallet.name validator
btcli wallet create --wallet.name miner_red
btcli wallet create --wallet.name miner_blue
```

## Create Subnet and Register

```bash
btcli subnet create --wallet.name validator --subtensor.network local

btcli subnet register --wallet.name validator --netuid 1 --subtensor.network local
btcli subnet register --wallet.name miner_red --netuid 1 --subtensor.network local
btcli subnet register --wallet.name miner_blue --netuid 1 --subtensor.network local
```

## Run

Terminal 1 - Red Miner:
```bash
python miner.py --role red --netuid 1 --wallet.name miner_red --axon.port 8091 --subtensor.network local
```

Terminal 2 - Blue Miner:
```bash
python miner.py --role blue --netuid 1 --wallet.name miner_blue --axon.port 8092 --subtensor.network local
```

Terminal 3 - Validator:
```bash
python validator.py --netuid 1 --wallet.name validator --red-uids 1 --blue-uids 2 --axon.port 8090 --subtensor.network local
```

Note: UIDs (1, 2) depend on registration order. Check with `btcli subnet list --netuid 1 --subtensor.network local`.

## Architecture

```
Validator (orchestrator)
  │
  ├── Query Red Miner → generates 5 attack prompts
  ├── Query Blue Miner → classifies prompts as safe/dangerous
  ├── Forward "safe" prompts → mock client model (echo)
  ├── Mock judge → randomly flags ~35% as dangerous
  ├── Score miners → red: bypass rate, blue: accuracy
  ├── Save flagged prompts → flagged_prompts.json
  └── Set weights on chain
```

Blue miners can fetch flagged prompts from the validator's axon endpoint (FlaggedPromptsSynapse) for future fine-tuning.
