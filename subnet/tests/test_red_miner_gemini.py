import os
import sys
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from protocol import RedTeamSynapse


def test_generate_prompts_uses_llm():
    with patch.dict(os.environ, {"OPENROUTER_API_KEY": "test-key"}):
        with patch("red_miner.LLMClient") as MockLLM:
            mock_instance = MagicMock()
            mock_instance.generate_adversarial_prompts.return_value = [
                "Attack prompt 1",
                "Attack prompt 2",
            ]
            MockLLM.return_value = mock_instance

            from red_miner import RedMiner
            with patch.object(RedMiner, "__init__", lambda self: None):
                miner = RedMiner.__new__(RedMiner)
                miner.llm = mock_instance

                synapse = RedTeamSynapse(
                    system_prompt="You are helpful.",
                    target_category="jailbreak",
                )
                result = miner.generate_prompts(synapse)

                mock_instance.generate_adversarial_prompts.assert_called_once_with(
                    system_prompt="You are helpful.",
                    category="jailbreak",
                )
                assert result.prompts == ["Attack prompt 1", "Attack prompt 2"]
