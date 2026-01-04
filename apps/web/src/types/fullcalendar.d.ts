declare module "@fullcalendar/react" {
  import type { ComponentType } from "react";
  const FullCalendar: ComponentType<Record<string, unknown>>;
  export default FullCalendar;
}

declare module "@fullcalendar/daygrid" {
  const plugin: Record<string, unknown>;
  export default plugin;
}

declare module "@fullcalendar/timegrid" {
  const plugin: Record<string, unknown>;
  export default plugin;
}

declare module "@fullcalendar/interaction" {
  const plugin: Record<string, unknown>;
  export default plugin;
}

declare module "react-calendar-heatmap" {
  import type { ComponentType } from "react";
  type Props = Record<string, unknown>;
  const Heatmap: ComponentType<Props>;
  export default Heatmap;
}
