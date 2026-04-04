"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type Props = {
  text: string;
};

/**
 * Info icon with hover (fine pointer) or tap (coarse) tooltip.
 */
export function Tooltip({ text }: Props) {
  const uid = useId();
  const tooltipId = `assumption-tip-${uid}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const isCoarsePointer = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(pointer: coarse)").matches;
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = containerRef.current;
      const target = e.target;
      if (!el || !(target instanceof Node) || el.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleMouseEnter = useCallback(() => {
    if (!isCoarsePointer()) setOpen(true);
  }, [isCoarsePointer]);

  const handleMouseLeave = useCallback(() => {
    if (!isCoarsePointer()) setOpen(false);
  }, [isCoarsePointer]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isCoarsePointer()) {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }
    },
    [isCoarsePointer],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className="relative ml-1.5 inline-flex items-center align-middle"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        aria-label="More information about this assumption"
        aria-expanded={open}
        aria-controls={tooltipId}
        aria-describedby={open ? tooltipId : undefined}
        className="inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border text-[11px] leading-none"
        style={{
          borderColor: "#A69486",
          color: "#A69486",
          background: "transparent",
        }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        ?
      </button>
      {open ? (
        <div
          id={tooltipId}
          role="tooltip"
          className="pointer-events-auto absolute bottom-[calc(100%+6px)] left-1/2 z-[80] max-w-[280px] -translate-x-1/2 rounded-md border px-[14px] py-[10px] text-left text-[13px] leading-[1.5] break-words whitespace-normal shadow-md"
          style={{
            backgroundColor: "#FAF8F4",
            borderColor: "#EDE8DF",
            color: "#2a2622",
            boxShadow: "0 4px 12px rgba(42, 38, 34, 0.08)",
          }}
        >
          {text}
          <div
            className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-[#EDE8DF]"
            aria-hidden
          />
        </div>
      ) : null}
    </div>
  );
}
