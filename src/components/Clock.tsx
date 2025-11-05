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
    <div className="badge badge-ghost text-sm font-mono">
      {time.toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </div>
  );
}
