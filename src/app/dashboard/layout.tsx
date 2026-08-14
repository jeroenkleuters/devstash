import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="dashboard-body">
        <TopBar />
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
