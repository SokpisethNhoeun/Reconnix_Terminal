/* A small brake on the assistant route (per dashboard process): at most PER_MINUTE questions a
   minute and RUNNING replies at once, so a stuck page can't flood the model. */

export const PER_MINUTE = 12;
export const RUNNING = 2;

export function createLimiter(perMinute = PER_MINUTE, running = RUNNING) {
  const recent: number[] = [];
  let open = 0;
  return {
    /** A slot for one reply, or null; call the returned release() when the reply ends. */
    take(now: number = Date.now()): (() => void) | null {
      while (recent.length && now - recent[0] >= 60_000) recent.shift();
      if (recent.length >= perMinute || open >= running) return null;
      recent.push(now);
      open += 1;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          open -= 1;
        }
      };
    },
  };
}
