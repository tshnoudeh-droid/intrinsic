"use client";

import { Show, UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WatchlistDrawer } from "@/components/WatchlistDrawer";
import { BrandMark } from "@/components/nav/BrandMark";
import { ProductTabs } from "@/components/nav/ProductTabs";
import { WatchlistNavButton } from "@/components/nav/WatchlistNavButton";
import { OPEN_WATCHLIST_EVENT } from "@/components/nav/products";

const AUTH_PATHS = ["/sign-in", "/sign-up"];

export function Navbar() {
  const { user, isSignedIn } = useUser();
  const pathname = usePathname() ?? "/";
  const userId = user?.id ?? null;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const onAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    const open = () => setDrawerOpen(true);
    window.addEventListener(OPEN_WATCHLIST_EVENT, open);
    return () => window.removeEventListener(OPEN_WATCHLIST_EVENT, open);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 shrink-0 border-b border-intrinsic-secondary/15 bg-intrinsic-light/80 backdrop-blur-md supports-[backdrop-filter]:bg-intrinsic-light/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:h-16 sm:px-6 lg:px-8">
          <BrandMark />

          <ProductTabs className="hidden sm:flex" />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <WatchlistNavButton
              isSignedIn={Boolean(isSignedIn)}
              onOpen={() => setDrawerOpen(true)}
            />
            <Show when="signed-in">
              <div className="ml-1 flex h-9 items-center">
                <UserButton />
              </div>
            </Show>
            <Show when="signed-out">
              {onAuthPage ? null : (
                <Link
                  href={`/sign-in?redirect_url=${encodeURIComponent(pathname)}`}
                  className="ml-1 inline-flex h-9 items-center rounded-full bg-intrinsic-ink px-4 text-sm font-medium text-intrinsic-light transition-opacity hover:opacity-90"
                >
                  Sign in
                </Link>
              )}
            </Show>
          </div>
        </div>

        <div className="border-t border-intrinsic-secondary/10 px-4 py-2 sm:hidden">
          <ProductTabs fill className="flex w-full" />
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
