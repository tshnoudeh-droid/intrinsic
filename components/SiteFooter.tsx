import Link from "next/link";

const PRODUCT_LINKS = [
  { href: "/explore", label: "Intrinsic Valuator" },
  { href: "/screener", label: "Intrinsic Screener" },
];

const EXTERNAL_LINKS = [
  { href: "https://linkedin.com/in/tawficshnoudeh", label: "LinkedIn" },
  { href: "https://tawficshnoudeh.com", label: "tawficshnoudeh.com" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-intrinsic-secondary/15 bg-intrinsic-light/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-sm sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-8">
        <div className="max-w-xs">
          <p className="font-semibold text-intrinsic-ink">Intrinsic</p>
          <p className="mt-1 text-xs leading-relaxed text-intrinsic-secondary">
            Built by Tawfic Alexander Shnoudeh. Estimates are educational, not
            financial advice.
          </p>
        </div>
        <div className="flex gap-12">
          <nav aria-label="Products" className="flex flex-col gap-2">
            {PRODUCT_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-intrinsic-ink-soft transition-colors hover:text-intrinsic-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Creator" className="flex flex-col gap-2">
            {EXTERNAL_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-intrinsic-ink-soft transition-colors hover:text-intrinsic-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
