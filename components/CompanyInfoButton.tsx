"use client";

import { Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  CompanyProfileBody,
  CompanyProfileSkeleton,
  StockPageLink,
} from "@/components/CompanyProfileBody";
import { useCompanyProfile } from "@/lib/company-profile-client";
import { normalizeSymbol } from "@/lib/symbol-normalize";

type Props = {
  symbol: string;
  name?: string;
  variant?: "icon" | "pill";
};

const POPOVER_WIDTH = 360;
const VIEWPORT_GAP = 12;
const MOBILE_QUERY = "(max-width: 639px)";

/** Keep clicks/keys inside the trigger or panel from reaching parent rows/links. */
function stop(e: SyntheticEvent) {
  e.stopPropagation();
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

/**
 * "What do they do?" trigger + popover (desktop) / bottom sheet (mobile).
 * Lazy-loads /api/company-profile on first open. Safe inside clickable rows.
 */
export default function CompanyInfoButton({
  symbol,
  name,
  variant = "icon",
}: Props) {
  const normalized = normalizeSymbol(symbol);
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const panelId = useId();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { state, retry } = useCompanyProfile(normalized, everOpened);

  const label = name ?? normalized;
  const onOwnPage =
    decodeURIComponent(pathname ?? "").toUpperCase() ===
    `/STOCK/${normalized}`.toUpperCase();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEverOpened(true);
    setOpen((o) => !o);
  };

  // Anchor the desktop popover to the trigger; flip above when cramped.
  // Writes straight to the panel's style (no state) to avoid extra renders.
  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(POPOVER_WIDTH, vw - VIEWPORT_GAP * 2);
    const left = Math.min(
      Math.max(VIEWPORT_GAP, rect.left + rect.width / 2 - width / 2),
      vw - width - VIEWPORT_GAP,
    );
    const spaceBelow = vh - rect.bottom - VIEWPORT_GAP;
    const spaceAbove = rect.top - VIEWPORT_GAP;
    const placeAbove = spaceBelow < 320 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(200, (placeAbove ? spaceAbove : spaceBelow) - 8);
    panel.style.left = `${left}px`;
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${maxHeight}px`;
    panel.style.top = placeAbove ? "auto" : `${rect.bottom + 8}px`;
    panel.style.bottom = placeAbove ? `${vh - rect.top + 8}px` : "auto";
  }, []);

  useLayoutEffect(() => {
    if (!open || isMobile) return;
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, isMobile, reposition]);

  // Esc + outside click close; focus moves into the panel on open.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) {
        return;
      }
      close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  // Lock page scroll behind the mobile sheet.
  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-intrinsic-secondary">
            <Sparkles className="h-3 w-3" aria-hidden />
            What they do
          </p>
          <h2
            id={titleId}
            className="mt-1 truncate text-base font-semibold text-intrinsic-ink"
          >
            {state.status === "ready" ? state.profile.name : label}
            <span className="ml-2 text-xs font-medium text-intrinsic-secondary">
              {normalized}
            </span>
          </h2>
        </div>
        <button
          type="button"
          onClick={() => close(true)}
          aria-label="Close"
          className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-intrinsic-secondary transition-colors hover:bg-intrinsic-bg hover:text-intrinsic-ink focus-visible:outline-2 focus-visible:outline-intrinsic-secondary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3" aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "ready" ? (
          <CompanyProfileBody profile={state.profile} />
        ) : state.status === "error" ? (
          <div className="rounded-xl bg-intrinsic-bg/60 px-4 py-3 text-sm text-intrinsic-secondary">
            {state.notFound ? (
              <p>We couldn&apos;t find a profile for {normalized}.</p>
            ) : (
              <>
                <p>Couldn&apos;t load this profile right now.</p>
                <button
                  type="button"
                  onClick={retry}
                  className="mt-2 text-xs font-semibold text-intrinsic-ink underline-offset-2 hover:underline"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        ) : (
          <CompanyProfileSkeleton />
        )}
      </div>

      {!onOwnPage ? (
        <div className="mt-4 border-t border-intrinsic-secondary/10 pt-3">
          <StockPageLink symbol={normalized} />
        </div>
      ) : null}
    </>
  );

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          // Wrapper stops React synthetic events bubbling (through the portal)
          // into a clickable parent row.
          <div onClick={stop} onKeyDown={stop} onPointerDown={stop}>
            {isMobile ? (
              <>
                <div
                  className="company-info-backdrop fixed inset-0 z-[90] bg-[#2a2622]/25"
                  aria-hidden
                  onClick={() => close(true)}
                />
                <div
                  ref={panelRef}
                  id={panelId}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  tabIndex={-1}
                  className="company-info-sheet fixed inset-x-0 bottom-0 z-[91] max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-intrinsic-secondary/15 bg-intrinsic-light px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-left shadow-[0_-12px_40px_rgba(42,38,34,0.14)] outline-none"
                >
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-intrinsic-secondary/30" aria-hidden />
                  {content}
                </div>
              </>
            ) : (
              <div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-labelledby={titleId}
                tabIndex={-1}
                className="company-info-popover fixed z-[91] overflow-y-auto rounded-2xl border border-intrinsic-secondary/15 bg-intrinsic-light p-5 text-left shadow-[0_18px_48px_rgba(42,38,34,0.16)] outline-none"
              >
                {content}
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  const triggerClasses =
    variant === "pill"
      ? "inline-flex h-7 items-center gap-1.5 rounded-full border border-intrinsic-secondary/30 bg-intrinsic-light/80 px-3 text-xs font-medium text-intrinsic-ink/80 transition-colors hover:border-intrinsic-secondary/60 hover:bg-intrinsic-accent/60 hover:text-intrinsic-ink"
      : "inline-flex h-6 w-6 items-center justify-center rounded-full border border-intrinsic-secondary/35 bg-intrinsic-light/70 text-intrinsic-secondary transition-colors hover:border-intrinsic-secondary/70 hover:bg-intrinsic-accent/60 hover:text-intrinsic-ink";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        onKeyDown={stop}
        onPointerDown={stop}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={variant === "icon" ? `What does ${label} do?` : undefined}
        title={variant === "icon" ? "What do they do?" : undefined}
        className={`${triggerClasses} shrink-0 cursor-pointer align-middle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-intrinsic-secondary ${
          open ? "border-intrinsic-secondary/70 bg-intrinsic-accent/70 text-intrinsic-ink" : ""
        }`}
      >
        <Sparkles className={variant === "pill" ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden />
        {variant === "pill" ? <span>What do they do?</span> : null}
      </button>
      {panel}
    </>
  );
}
