from bittensor import Synapse


class RoleDiscoverySynapse(Synapse):
    # Validator sends to discover miner role; miner fills `role` with "red" or "blue"
    role: str | None = None


class RedTeamSynapse(Synapse):
    # Validator sends to red miner to generate injection prompts
    system_prompt: str
    target_category: str
    prompts: list[str] | None = None


class BlueTeamSynapse(Synapse):
    # Validator sends to blue miner for classification of prompts
    prompts: list[str]
    classifications: list[str] | None = None
