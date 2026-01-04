import { Outlet } from "react-router-dom";

import { ServicesProvider } from "../hooks/useServicesOverview";

export default function ServicesLayout() {
  return (
    <ServicesProvider>
      <ServicesProvider>
        <Outlet />
      </ServicesProvider>
    </ServicesProvider>
  );
}
