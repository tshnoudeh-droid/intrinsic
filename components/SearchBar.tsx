export function SearchBar() {
  return (
    <div className="w-full max-w-xl">
      <label htmlFor="stock-search" className="sr-only">
        Search for a stock
      </label>
      <input
        id="stock-search"
        type="search"
        name="stock-search"
        placeholder="Search for a stock (e.g. AAPL, TSLA, SHOP)"
        autoComplete="off"
        className="w-full rounded-2xl border border-intrinsic-secondary/25 bg-intrinsic-light px-4 py-3.5 text-base text-intrinsic-ink shadow-sm placeholder:text-intrinsic-secondary/70 outline-none transition-[border-color,box-shadow] focus:border-intrinsic-secondary/40 focus:ring-2 focus:ring-intrinsic-accent focus:ring-offset-2 focus:ring-offset-intrinsic-bg sm:px-5 sm:py-4 sm:text-lg"
      />
    </div>
  );
}
