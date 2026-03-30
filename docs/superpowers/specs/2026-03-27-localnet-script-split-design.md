# Localnet Script Split Design

**Date:** 2026-03-27

**Goal:** Separate the localnet neuron registration phase from the validator staking phase while keeping a combined convenience wrapper for the existing flow.

## Scope

- Keep the current localnet flow easy to run from the README and bootstrap script.
- Introduce one script dedicated to neuron registration.
- Introduce one script dedicated to validator staking.
- Keep the combined script as a wrapper that calls both phases in order.

## Design

### Scripts

- `subnet/scripts/localnet/06_register_neurons.sh`
  Registers the 3 validator wallets and the 10 miner wallets using the existing `register_subnet_neuron.py` helper and the current `NETWORK` / `NETUID` environment contract.

- `subnet/scripts/localnet/07_stake_validators.sh`
  Stakes the 3 validator wallets using the existing `stake_validator.py` helper and the current `NETWORK`, `NETUID`, and `VALIDATOR_STAKE_AMOUNT` environment contract.

- `subnet/scripts/localnet/06_register_and_stake.sh`
  Remains as a convenience wrapper. It should stop containing phase logic directly and instead invoke the registration script and then the staking script.

### Compatibility

- Preserve existing env var names so the Python helpers and shell scripts keep the same interfaces.
- Preserve the combined wrapper name so callers do not break.
- Update tests and docs to reference the split scripts and the wrapper explicitly.

## Testing

- Update localnet script tests so the new scripts are expected and their contents are asserted.
- Verify the wrapper delegates to both scripts.
- Run the targeted localnet script tests after the change.
