import { useState, useEffect, useRef } from "react";

export default function Clock() {
  const [time, setTime] = useState(new Date());
  const lastMinuteRef = useRef(time.getMinutes());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentMinute = now.getMinutes();

      // Only update state when the minute actually changes
      if (currentMinute !== lastMinuteRef.current) {
        lastMinuteRef.current = currentMinute;
        setTime(now);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-base-300/60 bg-base-100/80 px-3 py-1 text-xs font-mono text-base-content shadow-sm backdrop-blur">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden="true" />
      <span>
        {time.toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
