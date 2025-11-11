import { Outlet } from "react-router-dom";
import { ServicesProvider } from "../../features/services/hooks/useServicesOverview";

export default function ServicesLayout() {
  return (
    <ServicesProvider>
      <Outlet />
    </ServicesProvider>
  );
}
