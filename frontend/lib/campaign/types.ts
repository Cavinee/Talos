type CampaignMinerIndex = 1;
type CampaignValidatorIndex = 1;

export type CampaignServiceKey =
  | `red_miner_${CampaignMinerIndex}`
  | `blue_miner_${CampaignMinerIndex}`
  | `validator_${CampaignValidatorIndex}`;

export type CampaignServiceStatus =
  | "stopped"
  | "starting"
  | "running"
  | "failed";

export type CampaignLauncherType = "process";

export interface CampaignServiceState {
  service: CampaignServiceKey;
  label: string;
  status: CampaignServiceStatus;
  launcher: CampaignLauncherType;
  scriptPath: string;
  commandLabel: string;
  launchedAt?: string;
  pid?: number;
  logPath?: string;
  lastKnownError?: string;
  debugLogTail?: string;
}

export type CampaignRuntimeState = Partial<
  Record<CampaignServiceKey, CampaignServiceState>
>;

export type CampaignServiceSnapshot = Partial<
  Record<CampaignServiceKey, CampaignServiceState>
>;

export interface CampaignServiceDefinition {
  key: CampaignServiceKey;
  label: string;
  scriptRelativePath: string;
  commandLabel: string;
  healthCheck: CampaignLauncherType;
  launchArguments?: string[];
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
  stopCampaignServices(): Promise<CampaignServiceSnapshot>;
}
