import { useEffect, useState } from "react";

export function useCaptureClock(initialNowMs: number) {
  const [browserNowMs, setBrowserNowMs] = useState<number | null>(null);

  useEffect(() => {
    function updateClock() {
      setBrowserNowMs(Date.now());
    }

    updateClock();
    const interval = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  // The server and the first browser render use the same clock value.
  return browserNowMs ?? initialNowMs;
}
