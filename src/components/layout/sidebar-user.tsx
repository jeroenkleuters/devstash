"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user/user-avatar";
import type { CurrentUser } from "@/lib/db/user";

interface SidebarUserProps {
  user: CurrentUser | null;
}

/**
 * The account row at the foot of the sidebar. The avatar opens the account
 * menu and the name links to the profile page — which is why the name sits
 * outside the trigger rather than inside it: a link nested in a button is
 * invalid, and the click would belong to whichever won.
 */
export function SidebarUser({ user }: SidebarUserProps) {
  const name = user?.name ?? user?.email ?? "";

  return (
    <div className="sidebar-user">
      <DropdownMenu>
        {/* The avatar is decorative, so the button needs a name of its own. */}
        <DropdownMenuTrigger
          className="sidebar-user-trigger"
          title={name}
          aria-label="Account menu"
        >
          <UserAvatar
            name={user?.name ?? null}
            email={user?.email ?? null}
            image={user?.image}
          />
        </DropdownMenuTrigger>

        {/* Opens upwards: the trigger sits against the bottom of the viewport. */}
        <DropdownMenuContent side="top" align="start">
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={signOutAction}>
            <DropdownMenuItem asChild>
              <button type="submit" className="sidebar-user-signout">
                <LogOut size={14} aria-hidden />
                Sign out
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="sidebar-user-meta">
        <Link href="/profile" className="sidebar-user-name" title={name}>
          {name}
        </Link>
        <span className="sidebar-user-email">{user?.email}</span>
      </span>
    </div>
  );
}
