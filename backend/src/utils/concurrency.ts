/**
 * Run an async worker over items with a fixed number of lanes, preserving
 * input order in the results. Lanes pull from a shared cursor, so a slow item
 * never blocks the others - unlike chunked batching, which waits for the
 * slowest member of every batch.
 *
 * The worker is expected to handle its own failures; a throw aborts the run.
 */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length)
  const lanes = Math.max(1, Math.min(concurrency, items.length))
  let cursor = 0

  const runLane = async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: lanes }, runLane))

  return results
}
