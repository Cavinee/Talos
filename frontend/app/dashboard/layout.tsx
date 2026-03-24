import TopBar from "@/components/shell/TopBar";
import Sidebar from "@/components/shell/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base">
      <TopBar />
      <div className="flex pt-14">
        <Sidebar />
        <main className="ml-60 flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
