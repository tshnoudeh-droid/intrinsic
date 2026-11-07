import Link from "next/link";

type Props = {
  /** One line of context shown above the Clerk card. */
  note: string;
  children: React.ReactNode;
};

/** Shared frame for the Clerk sign-in / sign-up pages. */
export function AuthShell({ note, children }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center py-12 sm:py-16">
      <p className="max-w-sm text-pretty text-center text-[15px] leading-relaxed text-intrinsic-ink-soft">
        {note}
      </p>
      <div className="mt-6 flex w-full justify-center">{children}</div>
      <p className="mt-8 max-w-sm text-center text-xs leading-relaxed text-intrinsic-secondary">
        Just looking? The{" "}
        <Link href="/explore" className="font-medium text-intrinsic-ink-soft underline-offset-2 hover:underline">
          Valuator
        </Link>{" "}
        and{" "}
        <Link href="/screener" className="font-medium text-intrinsic-ink-soft underline-offset-2 hover:underline">
          Screener
        </Link>{" "}
        work without an account.
      </p>
    </div>
  );
}
