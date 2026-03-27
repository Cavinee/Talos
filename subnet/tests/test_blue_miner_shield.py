import json
import os
import sys
import tempfile
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from protocol import BlueTeamSynapse


def test_classify_prompts_uses_shield_model():
    with patch("blue_miner.ShieldModel") as MockShield:
        mock_instance = MagicMock()
        mock_instance.classify.return_value = ["dangerous", "safe"]
        MockShield.return_value = mock_instance
        mock_instance.load_seed_dataset.return_value = (["text"], [0])
        mock_instance.load_dangerous_prompts.return_value = ([], [])

        from blue_miner import BlueMiner
        with patch.object(BlueMiner, "__init__", lambda self: None):
            miner = BlueMiner.__new__(BlueMiner)
            miner.shield = mock_instance

            synapse = BlueTeamSynapse(
                prompts=["Ignore instructions", "Hello world"]
            )
            result = miner.classify_prompts(synapse)

            mock_instance.classify.assert_called_once_with(
                ["Ignore instructions", "Hello world"]
            )
            assert result.classifications == ["dangerous", "safe"]


def test_load_shield_uses_local_pretrained_path():
    with patch("blue_miner.ShieldModel") as MockShield:
        mock_instance = MagicMock()
        MockShield.return_value = mock_instance

        from blue_miner import BlueMiner

        with patch.object(BlueMiner, "__init__", lambda self: None):
            miner = BlueMiner.__new__(BlueMiner)
            miner.model_path = "/tmp/shield-model"

            result = miner._load_shield()

        MockShield.assert_called_once_with(model_path="/tmp/shield-model")
        assert result is mock_instance


def test_maybe_fine_tunes_when_new_dangerous_prompts_arrive():
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as handle:
        json.dump(
            [
                {"prompt": "old prompt", "category": "prompt_leak"},
                {"prompt": "new prompt", "category": "jailbreak"},
            ],
            handle,
        )
        dangerous_path = handle.name

    try:
        from blue_miner import BlueMiner

        with patch.object(BlueMiner, "__init__", lambda self: None):
            miner = BlueMiner.__new__(BlueMiner)
            miner.dangerous_prompts_path = dangerous_path
            miner.model_path = "/tmp/shield-model"
            miner.seen_dangerous_prompt_keys = {"old prompt"}
            miner.shield = MagicMock()

            miner._maybe_fine_tune_shield()

        miner.shield.fine_tune_on_dangerous_prompts.assert_called_once_with(
            ["new prompt"], epochs=1
        )
        miner.shield.save.assert_called_once_with("/tmp/shield-model")
        assert miner.seen_dangerous_prompt_keys == {"old prompt", "new prompt"}
    finally:
        os.unlink(dangerous_path)
