import TargetSetup from "@/components/campaigns/TargetSetup";
import SandboxStatus from "@/components/campaigns/SandboxStatus";

export default function CampaignsPage() {
  return (
    <div className="space-y-8">
      <TargetSetup />
      <SandboxStatus />
    </div>
  );
}
