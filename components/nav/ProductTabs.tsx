"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRODUCTS } from "@/components/nav/products";

type Props = {
  className?: string;
  /** Stretch tabs to fill the container (mobile row). */
  fill?: boolean;
};

export function ProductTabs({ className = "", fill = false }: Props) {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Products"
      className={`items-center gap-1 rounded-full bg-intrinsic-bg/80 p-1 ring-1 ring-intrinsic-secondary/15 ${className}`}
    >
      {PRODUCTS.map((product) => {
        const active = product.isActive(pathname);
        const Icon = product.icon;
        return (
          <Link
            key={product.id}
            href={product.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
              fill ? "flex-1" : ""
            } ${
              active
                ? "bg-white text-intrinsic-ink shadow-sm shadow-black/5"
                : "text-intrinsic-ink-soft hover:text-intrinsic-ink"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {product.label}
          </Link>
        );
      })}
    </nav>
  );
}
