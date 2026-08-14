import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { TopBar } from "@/components/layout/top-bar";

export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <SidebarProvider>
      <Sidebar />
      <div className="dashboard-body">
        <TopBar />
        <main className="dashboard-main">{children}</main>
      </div>
    </SidebarProvider>
  );
}
