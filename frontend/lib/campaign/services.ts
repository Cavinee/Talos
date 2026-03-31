import type {
  CampaignServiceDefinition,
  CampaignServiceKey,
  CampaignServiceSnapshot,
  CampaignServiceState,
} from "./types";

function createProcessServiceState(
  definition: CampaignServiceDefinition,
): CampaignServiceState {
  return {
    service: definition.key,
    label: definition.label,
    status: "stopped",
    launcher: definition.healthCheck,
    scriptPath: "",
    commandLabel: definition.commandLabel,
  };
}

export const CAMPAIGN_SERVICE_ORDER: CampaignServiceKey[] = [
  "red_miner_1",
  "blue_miner_1",
  "validator_1",
];

const TESTNET_SERVICE_DEFINITIONS: CampaignServiceDefinition[] = [
  {
    key: "red_miner_1",
    label: "Red Miner 1",
    scriptRelativePath: "subnet/scripts/testnet/01_run_red_miner.sh",
    commandLabel: "red miner 1",
    healthCheck: "process",
    launchArguments: ["1"],
    logFileName: "red_miner_1.log",
  },
  {
    key: "blue_miner_1",
    label: "Blue Miner 1",
    scriptRelativePath: "subnet/scripts/testnet/02_run_blue_miner.sh",
    commandLabel: "blue miner 1",
    healthCheck: "process",
    launchArguments: ["1"],
    logFileName: "blue_miner_1.log",
  },
  {
    key: "validator_1",
    label: "Validator 1",
    scriptRelativePath: "subnet/scripts/testnet/03_run_validator.sh",
    commandLabel: "validator 1",
    healthCheck: "process",
    launchArguments: ["1"],
    logFileName: "validator_1.log",
  },
];

export const DEFAULT_CAMPAIGN_SERVICE_DEFINITIONS: CampaignServiceDefinition[] =
  TESTNET_SERVICE_DEFINITIONS;

export function createDefaultCampaignServiceSnapshot(): CampaignServiceSnapshot {
  const snapshot: CampaignServiceSnapshot = {};

  for (const definition of DEFAULT_CAMPAIGN_SERVICE_DEFINITIONS) {
    snapshot[definition.key] = createProcessServiceState(definition);
  }

  return snapshot;
}
