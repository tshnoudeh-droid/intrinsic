"use client";

export function LandingCta() {
  return (
    <div className="flex flex-col items-center gap-5 text-center sm:gap-6">
      <p className="text-lg font-medium text-intrinsic-ink sm:text-xl">
        Start exploring stocks now
      </p>
      <button
        type="button"
        className="rounded-full bg-intrinsic-ink px-8 py-3 text-sm font-semibold text-intrinsic-light shadow-sm transition-colors duration-200 hover:bg-intrinsic-ink/90 sm:text-base"
        onClick={() => {
          document.getElementById("landing-search")?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          window.setTimeout(() => {
            document.getElementById("stock-search")?.focus();
          }, 400);
        }}
      >
        Search a stock
      </button>
    </div>
  );
}
