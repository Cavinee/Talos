import random


def mock_client_model(prompt: str) -> str:
    return prompt


def mock_judge(prompt: str, response: str) -> tuple[bool, float]:
    is_dangerous = random.random() < 0.35
    threat_score = round(random.uniform(0.6, 1.0), 2) if is_dangerous else 0.0
    return is_dangerous, threat_score
