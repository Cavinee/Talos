import TargetSetup from "@/components/campaigns/TargetSetup";
import SandboxStatus from "@/components/campaigns/SandboxStatus";

export default function CampaignsPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-secondary">
          Campaign Operations
        </p>
        <div className="max-w-3xl">
          <h1 className="text-text-primary text-3xl font-semibold">
            Launch and monitor the testnet campaign stack
          </h1>
          <p className="text-text-secondary text-sm mt-2">
            Bring miners and the validator online from a single page,
            then watch their live status rehydrate after refreshes and launch cycles.
          </p>
        </div>
      </section>
      <TargetSetup />
      <SandboxStatus />
    </div>
  );
}
