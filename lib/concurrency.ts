/**
 * Runs `worker` over `items` with at most `concurrency` in flight at once.
 * Used to batch the nightly screener refresh (~560 Yahoo Finance calls)
 * within Vercel's serverless function duration limit instead of running
 * them fully sequentially.
 */
export async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < items.length) {
      const current = items[index];
      index++;
      await worker(current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runNext(),
  );
  await Promise.all(workers);
}
