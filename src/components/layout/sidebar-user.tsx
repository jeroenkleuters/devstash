"use client";

import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";

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
 * The account row at the foot of the sidebar. The whole row opens the account
 * menu — the profile page is reached from inside it, so the name beside the
 * avatar is plain text and has no click of its own to compete with.
 */
export function SidebarUser({ user }: SidebarUserProps) {
  const name = user?.name ?? user?.email ?? "";

  return (
    <div className="sidebar-user">
      <DropdownMenu>
        {/* The avatar is decorative, so the name and email inside are what give
            this button its accessible name. */}
        <DropdownMenuTrigger className="sidebar-user-trigger" title={name}>
          <UserAvatar
            name={user?.name ?? null}
            email={user?.email ?? null}
            image={user?.image}
          />

          <span className="sidebar-user-meta">
            <span className="sidebar-user-name">{name}</span>
            <span className="sidebar-user-email">{user?.email}</span>
          </span>
        </DropdownMenuTrigger>

        {/* Opens upwards: the trigger sits against the bottom of the viewport. */}
        <DropdownMenuContent side="top" align="start">
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/profile">
              <User size={14} aria-hidden />
              Profile
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings size={14} aria-hidden />
              Settings
            </Link>
          </DropdownMenuItem>

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
    </div>
  );
}
