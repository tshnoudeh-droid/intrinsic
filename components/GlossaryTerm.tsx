"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

type Props = {
  term: GlossaryKey;
  /** Visible text; defaults to the glossary term. */
  children?: React.ReactNode;
  className?: string;
};

const WIDTH = 280;
const GAP = 12;

/**
 * Inline word with a dotted underline. Hover (mouse) or tap / Enter shows a
 * short plain-English definition from lib/glossary.ts. Esc or outside tap closes.
 */
export function GlossaryTerm({ term, children, className = "" }: Props) {
  const entry = GLOSSARY[term];
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipId = useId();

  const place = useCallback(() => {
    const t = triggerRef.current;
    const tip = tipRef.current;
    if (!t || !tip) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(WIDTH, vw - GAP * 2);
    const left = Math.min(Math.max(GAP, r.left + r.width / 2 - width / 2), vw - width - GAP);
    tip.style.width = `${width}px`;
    tip.style.left = `${left}px`;
    const above = r.top > tip.offsetHeight + 16;
    tip.style.top = above ? `${r.top - tip.offsetHeight - 8}px` : `${r.bottom + 8}px`;
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      const n = e.target;
      if (n instanceof Node && !triggerRef.current?.contains(n) && !tipRef.current?.contains(n)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const fine = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
  const clearTimer = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onMouseEnter={() => {
          if (!fine()) return;
          clearTimer();
          hoverTimer.current = setTimeout(() => setOpen(true), 120);
        }}
        onMouseLeave={() => {
          if (!fine()) return;
          clearTimer();
          hoverTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        className={`inline cursor-help rounded-sm underline decoration-intrinsic-secondary/60 decoration-dotted underline-offset-[3px] transition-colors hover:decoration-intrinsic-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-intrinsic-secondary ${className}`}
      >
        {children ?? entry.term}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              onMouseEnter={clearTimer}
              onMouseLeave={() => fine() && setOpen(false)}
              className="company-info-popover fixed z-[95] rounded-2xl border border-intrinsic-secondary/15 bg-intrinsic-light px-4 py-3 text-left shadow-[0_14px_40px_rgba(42,38,34,0.16)]"
              style={{ top: -9999, left: 0 }}
            >
              <p className="text-[13px] font-semibold text-intrinsic-ink">{entry.term}</p>
              <p className="mt-1 text-[13px] font-normal normal-case leading-relaxed tracking-normal text-intrinsic-ink/75">
                {entry.definition}
              </p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
