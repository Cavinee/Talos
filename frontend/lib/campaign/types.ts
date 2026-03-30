type CampaignMinerIndex = 1 | 2 | 3 | 4 | 5;
type CampaignValidatorIndex = 1 | 2 | 3;

export type CampaignServiceKey =
  | "local_chain"
  | `red_miner_${CampaignMinerIndex}`
  | `blue_miner_${CampaignMinerIndex}`
  | `validator_${CampaignValidatorIndex}`;

export type CampaignServiceStatus =
  | "stopped"
  | "starting"
  | "running"
  | "failed";

export type CampaignLauncherType = "docker" | "process";

export interface CampaignServiceState {
  service: CampaignServiceKey;
  label: string;
  status: CampaignServiceStatus;
  launcher: CampaignLauncherType;
  scriptPath: string;
  commandLabel: string;
  launchedAt?: string;
  pid?: number;
  containerName?: string;
  containerId?: string;
  logPath?: string;
  lastKnownError?: string;
  debugLogTail?: string;
}

export type CampaignRuntimeState = Partial<
  Record<CampaignServiceKey, CampaignServiceState>
>;

export type CampaignServiceSnapshot = Record<
  CampaignServiceKey,
  CampaignServiceState
>;

export interface CampaignServiceDefinition {
  key: CampaignServiceKey;
  label: string;
  scriptRelativePath: string;
  commandLabel: string;
  healthCheck: CampaignLauncherType;
  launchArguments?: string[];
  containerName?: string;
  logFileName?: string;
}

export interface CampaignPreflightBlocker {
  code: string;
  title: string;
  detail: string;
  readmeStep: string;
  commands: string[];
  affectedWallets?: string[];
}

export interface CampaignPreflightResult {
  ready: boolean;
  checkedAt: string;
  chainEndpoint: string;
  netuid: number;
  readmePath: string;
  blockers: CampaignPreflightBlocker[];
}

export interface CampaignLaunchBlockedResult {
  launchStarted: false;
  services: CampaignServiceSnapshot;
  preflight: CampaignPreflightResult;
}

export type CampaignLaunchResult =
  | CampaignServiceSnapshot
  | CampaignLaunchBlockedResult;

export function isLaunchBlocked(
  result: CampaignLaunchResult,
): result is CampaignLaunchBlockedResult {
  return (
    "launchStarted" in result &&
    (result as CampaignLaunchBlockedResult).launchStarted === false
  );
}

export interface CampaignProcessManager {
  getCampaignServiceSnapshot(): Promise<CampaignServiceSnapshot>;
  launchCampaignServices(): Promise<CampaignLaunchResult>;
}
