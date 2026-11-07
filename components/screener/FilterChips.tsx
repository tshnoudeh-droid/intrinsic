"use client";

import { Check, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
  FILTER_EDIT_UNITS,
  FILTER_FIELD_LABELS,
  editableToFilterValue,
  filterValueToEditable,
  formatFilterChip,
} from "@/lib/screener-format";
import {
  SCREENER_VALUATION_LABELS,
  type ScreenerFilter,
  type ScreenerFilterOperator,
} from "@/lib/screener-types";

type Props = {
  filters: ScreenerFilter[];
  disabled?: boolean;
  onChange: (filters: ScreenerFilter[]) => void;
};

/** Human-readable, editable, removable chips for the applied filters. */
export function FilterChips({ filters, disabled, onChange }: Props) {
  const [editing, setEditing] = useState<number | null>(null);

  if (filters.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Applied filters">
      {filters.map((filter, i) => (
        <li key={`${filter.field}-${filter.operator}-${i}`} className="relative">
          <div className="inline-flex h-8 items-center rounded-full border border-intrinsic-secondary/25 bg-intrinsic-light text-[13px] text-intrinsic-ink shadow-[0_1px_0_rgba(42,38,34,0.03)]">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setEditing(editing === i ? null : i)}
              aria-expanded={editing === i}
              className="h-full rounded-l-full pl-3 pr-1.5 font-medium transition-colors hover:text-intrinsic-ink/70 disabled:opacity-50"
              title="Edit filter"
            >
              {formatFilterChip(filter)}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setEditing(null);
                onChange(filters.filter((_, j) => j !== i));
              }}
              aria-label={`Remove filter ${formatFilterChip(filter)}`}
              className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-intrinsic-secondary transition-colors hover:bg-intrinsic-bg hover:text-intrinsic-ink disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          {editing === i ? (
            <FilterEditor
              filter={filter}
              onCancel={() => setEditing(null)}
              onApply={(next) => {
                setEditing(null);
                onChange(filters.map((f, j) => (j === i ? next : f)));
              }}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function FilterEditor({
  filter,
  onApply,
  onCancel,
}: {
  filter: ScreenerFilter;
  onApply: (f: ScreenerFilter) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const inputId = useId();
  const isLabel = filter.field === "valuation_label";
  const [operator, setOperator] = useState<ScreenerFilterOperator>(
    filter.operator === "gt" || filter.operator === "gte" ? "gte" : "lte",
  );
  const [text, setText] = useState(
    isLabel ? String(filter.value) : String(filterValueToEditable(filter) ?? ""),
  );

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) onCancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  const unit = filter.field === "valuation_label" ? null : FILTER_EDIT_UNITS[filter.field];
  const parsed = Number(text);
  const valid = isLabel ? text.length > 0 : text.trim() !== "" && Number.isFinite(parsed);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    if (filter.field === "valuation_label") {
      onApply({ field: filter.field, operator: "eq", value: text });
      return;
    }
    onApply({
      field: filter.field,
      operator,
      value: editableToFilterValue(filter.field, parsed),
    });
  }

  return (
    <form
      ref={ref}
      onSubmit={submit}
      className="absolute left-0 top-[calc(100%+6px)] z-30 w-64 rounded-2xl border border-intrinsic-secondary/15 bg-intrinsic-light p-3 shadow-[0_14px_40px_rgba(42,38,34,0.14)]"
    >
      <label htmlFor={inputId} className="block text-xs font-medium text-intrinsic-secondary">
        {FILTER_FIELD_LABELS[filter.field]}
      </label>
      {isLabel ? (
        <div className="mt-2 flex gap-1.5">
          {SCREENER_VALUATION_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setText(label)}
              className={`flex-1 rounded-full px-2 py-1.5 text-xs font-medium transition-colors ${
                text === label
                  ? "bg-intrinsic-ink text-intrinsic-light"
                  : "bg-intrinsic-bg text-intrinsic-ink hover:bg-intrinsic-bg/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex rounded-full bg-intrinsic-bg p-0.5" role="group" aria-label="Comparison">
            {(["gte", "lte"] as const).map((op) => (
              <button
                key={op}
                type="button"
                aria-pressed={operator === op}
                onClick={() => setOperator(op)}
                className={`h-7 w-8 rounded-full text-sm transition-colors ${
                  operator === op ? "bg-intrinsic-light text-intrinsic-ink shadow-sm" : "text-intrinsic-secondary"
                }`}
              >
                {op === "gte" ? "≥" : "≤"}
              </button>
            ))}
          </div>
          <div className="flex h-8 flex-1 items-center rounded-full border border-intrinsic-secondary/25 bg-white/60 px-3 text-sm focus-within:border-intrinsic-secondary">
            {unit?.prefix ? <span className="text-intrinsic-secondary">{unit.prefix}</span> : null}
            <input
              id={inputId}
              autoFocus
              inputMode="decimal"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full min-w-0 bg-transparent text-intrinsic-ink outline-none"
            />
            {unit?.suffix ? <span className="text-intrinsic-secondary">{unit.suffix}</span> : null}
          </div>
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-xs font-medium text-intrinsic-secondary hover:text-intrinsic-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!valid}
          className="inline-flex items-center gap-1 rounded-full bg-intrinsic-ink px-3 py-1.5 text-xs font-medium text-intrinsic-light disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          Apply
        </button>
      </div>
    </form>
  );
}
