import json
import os
import threading

import torch
from transformers import (
    DistilBertForSequenceClassification,
    DistilBertTokenizer,
)


SAFE_REPLAY_PROMPTS = [
    "What is the weather today?",
    "Tell me a joke about computers.",
    "How do I boil pasta?",
    "Summarize the plot of Romeo and Juliet.",
    "What is 12 multiplied by 8?",
]


class PromptDataset(torch.utils.data.Dataset):
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        item = {key: val[idx] for key, val in self.encodings.items()}
        item["labels"] = torch.tensor(self.labels[idx], dtype=torch.long)
        return item


class ShieldModel:
    def __init__(
        self,
        model_name: str = "distilbert-base-uncased",
        model_path: str | None = None,
    ):
        self.model_name = model_name
        self.model_path = model_path
        self._lock = threading.RLock()

        source = model_path if model_path and os.path.isdir(model_path) else model_name
        self.tokenizer = DistilBertTokenizer.from_pretrained(source)
        if source == model_name:
            self.model = DistilBertForSequenceClassification.from_pretrained(
                source, num_labels=2
            )
        else:
            self.model = DistilBertForSequenceClassification.from_pretrained(source)
        self.model.eval()

    def load_seed_dataset(self) -> tuple[list[str], list[int]]:
        """Load the deepset/prompt-injections dataset via HuggingFace Hub API."""
        from huggingface_hub import hf_hub_download
        import pyarrow.parquet as pq

        path = hf_hub_download(
            repo_id="deepset/prompt-injections",
            filename="data/train-00000-of-00001-9564e8b05b4757ab.parquet",
            repo_type="dataset",
        )
        table = pq.read_table(path)
        texts = table.column("text").to_pylist()
        labels = table.column("label").to_pylist()
        return texts, labels

    def load_dangerous_prompts(self, path: str) -> tuple[list[str], list[int]]:
        if not os.path.exists(path):
            return [], []
        with open(path) as f:
            entries = json.load(f)
        texts = [entry["prompt"] for entry in entries if "prompt" in entry]
        labels = [1] * len(texts)
        return texts, labels

    def train(self, texts: list[str], labels: list[int], epochs: int = 3):
        if not texts:
            return
        encodings = self.tokenizer(
            texts, truncation=True, padding=True, max_length=512, return_tensors="pt"
        )
        dataset = PromptDataset(encodings, labels)
        loader = torch.utils.data.DataLoader(dataset, batch_size=16, shuffle=True)

        with self._lock:
            self.model.train()
            optimizer = torch.optim.AdamW(self.model.parameters(), lr=5e-5)

            for epoch in range(epochs):
                for batch in loader:
                    optimizer.zero_grad()
                    outputs = self.model(**batch)
                    loss = outputs.loss
                    loss.backward()
                    optimizer.step()

            self.model.eval()

    def fine_tune_on_dangerous_prompts(self, prompts: list[str], epochs: int = 1):
        if not prompts:
            return
        texts = SAFE_REPLAY_PROMPTS + prompts
        labels = [0] * len(SAFE_REPLAY_PROMPTS) + [1] * len(prompts)
        self.train(texts, labels, epochs=epochs)

    def save(self, path: str):
        os.makedirs(path, exist_ok=True)
        with self._lock:
            self.tokenizer.save_pretrained(path)
            self.model.save_pretrained(path)

    def classify(self, prompts: list[str]) -> list[str]:
        if not prompts:
            return []
        encodings = self.tokenizer(
            prompts, truncation=True, padding=True, max_length=512, return_tensors="pt"
        )
        with self._lock:
            self.model.eval()
            with torch.no_grad():
                outputs = self.model(**encodings)
        predictions = torch.argmax(outputs.logits, dim=-1).tolist()
        return ["dangerous" if p == 1 else "safe" for p in predictions]
