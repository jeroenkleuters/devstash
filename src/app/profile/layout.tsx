import { AppShell } from "@/components/layout/app-shell";

// The sidebar reads its types and collections per request.
export const dynamic = "force-dynamic";

export default function ProfileLayout({ children }: LayoutProps<"/profile">) {
  return <AppShell>{children}</AppShell>;
}
