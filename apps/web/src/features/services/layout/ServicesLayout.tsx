import { Outlet } from "@tanstack/react-router";

import { ServicesProvider } from "../hooks/useServicesOverview";

export default function ServicesLayout() {
  return (
    <ServicesProvider>
      <Outlet />
    </ServicesProvider>
  );
}
