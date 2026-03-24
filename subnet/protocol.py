import typing
import bittensor as bt


class RedTeamSynapse(bt.Synapse):
    target_description: str = ""
    attack_prompts: typing.Optional[typing.List[str]] = None


class BlueTeamSynapse(bt.Synapse):
    prompts: typing.List[str] = []
    classifications: typing.Optional[typing.List[str]] = None


class FlaggedPromptsSynapse(bt.Synapse):
    flagged_data: typing.Optional[str] = None
