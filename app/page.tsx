import { SearchBar } from "@/components/SearchBar";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 py-16 text-center sm:gap-12 sm:py-20 lg:py-24">
      <div className="max-w-2xl space-y-5 sm:space-y-6">
        <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-intrinsic-ink sm:text-4xl lg:text-5xl">
          Find the true value of any stock
        </h1>
        <p className="text-pretty text-lg leading-relaxed text-intrinsic-secondary sm:text-xl">
          A simple, Canadian-focused way to see if a stock is overvalued or
          undervalued.
        </p>
      </div>
      <SearchBar />
    </div>
  );
}
