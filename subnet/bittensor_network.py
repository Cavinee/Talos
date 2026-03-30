from __future__ import annotations


def resolve_subtensor_target(config) -> str | None:
    subtensor_config = getattr(config, "subtensor", None)
    if subtensor_config is None:
        return None

    chain_endpoint = getattr(subtensor_config, "chain_endpoint", None)
    if isinstance(chain_endpoint, str) and chain_endpoint.strip():
        return chain_endpoint.strip()

    network = getattr(subtensor_config, "network", None)
    if isinstance(network, str) and network.strip():
        return network.strip()

    return None
