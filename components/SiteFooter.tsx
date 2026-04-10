import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-intrinsic-secondary/15 bg-intrinsic-bg/80 py-8 text-center text-xs text-[#A69486] sm:py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 sm:px-6 lg:px-8">
        <p>Intrinsic. Not financial advice.</p>
        <p className="max-w-md text-pretty text-intrinsic-secondary">
          Intrinsic built by Tawfic Alexander Shnoudeh
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link
            href="https://linkedin.com/in/tawficshnoudeh"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#A69486] underline-offset-2 transition-colors hover:text-intrinsic-ink hover:underline"
          >
            LinkedIn
          </Link>
          <span className="text-intrinsic-secondary/40" aria-hidden>
            ·
          </span>
          <Link
            href="https://tawficshnoudeh.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#A69486] underline-offset-2 transition-colors hover:text-intrinsic-ink hover:underline"
          >
            tawficshnoudeh.com
          </Link>
        </div>
      </div>
    </footer>
  );
}
