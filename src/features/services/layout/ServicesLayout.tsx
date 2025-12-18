import { Outlet } from "react-router-dom";
import { ServicesProvider } from "../hooks/useServicesOverview";
import { PAGE_CONTAINER } from "@/lib/styles";

export default function ServicesLayout() {
  return (
    <ServicesProvider>
      <div className={PAGE_CONTAINER}>
        <Outlet />
      </div>
    </ServicesProvider>
  );
}
