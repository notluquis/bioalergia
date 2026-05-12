import { useEffect, useRef, useState } from "react";
export function Clock() {
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
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-default-200/60 bg-background/80 px-3 py-1 font-mono text-foreground text-xs shadow-sm backdrop-blur">
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-primary/70" />
      <span>
        {time.toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
