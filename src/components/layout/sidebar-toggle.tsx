"use client";

import { PanelLeft } from "lucide-react";

import { useSidebar } from "@/components/layout/sidebar-provider";
import { Button } from "@/components/ui/button";

export function SidebarToggle() {
  const { toggle } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      aria-label="Toggle sidebar"
      onClick={toggle}
    >
      <PanelLeft aria-hidden />
    </Button>
  );
}
