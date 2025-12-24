import { Outlet } from "react-router-dom";
import { PAGE_CONTAINER } from "@/lib/styles";

export default function CalendarLayout() {
  return (
    <div className={PAGE_CONTAINER}>
      <Outlet />
    </div>
  );
}
