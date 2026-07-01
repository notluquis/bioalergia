import { Skeleton } from "@heroui/react";
import { lazy, Suspense, useMemo } from "react";

import type { SocialPost } from "../types";
import { SOCIAL_POST_STATUS_LABELS } from "../types";

// Lazy-load FullCalendar + plugins so the chunk only enters the network when
// this tab is actually mounted (parent gates mount via `useLazyTabs`).
const CalendarGrid = lazy(async () => {
  const [{ default: FullCalendar }, { default: dayGridPlugin }, { default: timeGridPlugin }] =
    await Promise.all([
      import("@fullcalendar/react"),
      import("@fullcalendar/daygrid"),
      import("@fullcalendar/timegrid"),
    ]);

  return {
    default: function CalendarGridImpl({ events }: { events: ContentCalendarEvent[] }) {
      return (
        <FullCalendar
          contentHeight="auto"
          dayMaxEvents={4}
          editable={false}
          eventBackgroundColor="var(--color-primary)"
          eventBorderColor="var(--color-primary)"
          eventDisplay="block"
          events={events}
          eventTextColor="var(--color-primary-foreground)"
          eventTimeFormat={{ hour: "2-digit", hour12: false, meridiem: false, minute: "2-digit" }}
          headerToolbar={{
            center: "title",
            left: "prev,next today",
            right: "dayGridMonth,timeGridWeek",
          }}
          height="auto"
          initialView="dayGridMonth"
          locale="es"
          nowIndicator
          plugins={[dayGridPlugin, timeGridPlugin]}
          selectable={false}
          viewDidMount={() => {
            for (const icon of document.querySelectorAll(".social-content-calendar .fc-icon")) {
              icon.setAttribute("aria-hidden", "true");
            }
          }}
        />
      );
    },
  };
});

interface ContentCalendarEvent {
  id: string;
  start: string;
  title: string;
}

function toEvents(posts: SocialPost[]): ContentCalendarEvent[] {
  const out: ContentCalendarEvent[] = [];
  for (const post of posts) {
    if (!post.scheduledAt) continue;
    const start =
      post.scheduledAt instanceof Date ? post.scheduledAt.toISOString() : String(post.scheduledAt);
    const label = post.title?.trim() || post.caption?.trim() || "Publicación";
    out.push({
      id: String(post.id),
      start,
      title: `${label.length > 40 ? `${label.slice(0, 40)}…` : label} (${SOCIAL_POST_STATUS_LABELS[post.status]})`,
    });
  }
  return out;
}

export function ContentCalendar({ posts }: Readonly<{ posts: SocialPost[] }>) {
  const events = useMemo(() => toEvents(posts), [posts]);

  return (
    <div className="social-content-calendar">
      <Suspense
        fallback={
          <Skeleton
            aria-label="Cargando calendario"
            className="h-96 w-full rounded-xl"
            role="img"
          />
        }
      >
        <CalendarGrid events={events} />
      </Suspense>
    </div>
  );
}
