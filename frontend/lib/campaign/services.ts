import type {
  CampaignServiceDefinition,
  CampaignServiceKey,
  CampaignServiceSnapshot,
  CampaignServiceState,
} from "./types";

const RED_MINER_INDICES = [1, 2, 3, 4, 5] as const;
const BLUE_MINER_INDICES = [1, 2, 3, 4, 5] as const;
const VALIDATOR_INDICES = [1, 2, 3] as const;

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
  "local_chain",
  ...RED_MINER_INDICES.map((index) => `red_miner_${index}` as const),
  ...BLUE_MINER_INDICES.map((index) => `blue_miner_${index}` as const),
  ...VALIDATOR_INDICES.map((index) => `validator_${index}` as const),
];

export const DEFAULT_CAMPAIGN_SERVICE_DEFINITIONS: CampaignServiceDefinition[] = [
  {
    key: "local_chain",
    label: "Local Chain",
    scriptRelativePath: "subnet/scripts/localnet/02_start_chain.sh",
    commandLabel: "docker run local_chain",
    healthCheck: "docker",
    containerName: "local_chain",
  },
  ...RED_MINER_INDICES.map((index) => ({
    key: `red_miner_${index}` as const,
    label: `Red Miner ${index}`,
    scriptRelativePath: "subnet/scripts/localnet/07_run_red_miner.sh",
    commandLabel: `red miner ${index}`,
    healthCheck: "process" as const,
    launchArguments: [`${index}`],
    logFileName: `red_miner_${index}.log`,
  })),
  ...BLUE_MINER_INDICES.map((index) => ({
    key: `blue_miner_${index}` as const,
    label: `Blue Miner ${index}`,
    scriptRelativePath: "subnet/scripts/localnet/08_run_blue_miner.sh",
    commandLabel: `blue miner ${index}`,
    healthCheck: "process" as const,
    launchArguments: [`${index}`],
    logFileName: `blue_miner_${index}.log`,
  })),
  ...VALIDATOR_INDICES.map((index) => ({
    key: `validator_${index}` as const,
    label: `Validator ${index}`,
    scriptRelativePath: "subnet/scripts/localnet/09_run_validator.sh",
    commandLabel: `validator ${index}`,
    healthCheck: "process" as const,
    launchArguments: [`${index}`],
    logFileName: `validator_${index}.log`,
  })),
];

export function createDefaultCampaignServiceSnapshot(): CampaignServiceSnapshot {
  const snapshot = {} as CampaignServiceSnapshot;

  for (const definition of DEFAULT_CAMPAIGN_SERVICE_DEFINITIONS) {
    snapshot[definition.key] =
      definition.healthCheck === "docker"
        ? {
            ...createProcessServiceState(definition),
            containerName: definition.containerName,
          }
        : createProcessServiceState(definition);
  }

  return snapshot;
}
