import Link from "next/link";

/** Intrinsic wordmark: serif "I" tile (matches the favicon) + name. */
export function BrandMark() {
  return (
    <Link
      href="/"
      aria-label="Intrinsic home"
      className="group inline-flex shrink-0 items-center gap-2"
    >
      <span
        aria-hidden
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-intrinsic-ink font-serif text-[17px] leading-none text-intrinsic-light transition-transform duration-200 group-hover:-rotate-3"
      >
        I
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-intrinsic-ink">
        Intrinsic
      </span>
    </Link>
  );
}
