import { AppShell } from "@/components/layout/app-shell";

// The sidebar reads its types and collections per request.
export const dynamic = "force-dynamic";

export default function CollectionsLayout({
  children,
}: LayoutProps<"/collections">) {
  return <AppShell>{children}</AppShell>;
}
