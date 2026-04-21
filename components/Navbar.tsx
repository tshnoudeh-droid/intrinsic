"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useState } from "react";
import { WatchlistDrawer } from "@/components/WatchlistDrawer";

export function Navbar() {
  const { user, isSignedIn } = useUser();
  const userId = user?.id ?? null;
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="shrink-0 border-b border-intrinsic-secondary/15 bg-intrinsic-light/60 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link
            href={isSignedIn ? "/?home=1" : "/"}
            className="text-lg font-medium tracking-tight text-intrinsic-ink transition-colors hover:text-intrinsic-secondary sm:text-xl"
          >
            Intrinsic
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Show when="signed-in">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open watchlist"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-intrinsic-secondary transition-colors hover:bg-intrinsic-secondary/10 hover:text-intrinsic-ink"
                >
                  <Bookmark className="h-5 w-5" strokeWidth={1.75} />
                </button>
                <UserButton />
              </div>
            </Show>
          </div>
        </div>
      </header>
      <WatchlistDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userId={userId}
      />
    </>
  );
}
