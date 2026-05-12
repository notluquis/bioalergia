import { Skeleton, Tabs } from "@heroui/react";
import { getRouteApi } from "@tanstack/react-router";
import { Suspense } from "react";

import { PersonalGastosTab } from "../components/PersonalGastosTab";
import { ProviderCredentialsTab } from "../components/ProviderCredentialsTab";
import { UtilityAccountsTab } from "../components/UtilityAccountsTab";
import { PersonalCreditsPageWrapper } from "./PersonalCreditsPage";

type TabKey = "creditos" | "credenciales" | "servicios" | "gastos";

const routeApi = getRouteApi("/_authed/finanzas/personal");

export function PersonalPage() {
  const { tab } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  function handleTabChange(key: TabKey) {
    void navigate({ search: (prev) => ({ ...prev, tab: key }) });
  }

  return (
    <div className="space-y-4">
      <Tabs selectedKey={tab} onSelectionChange={(key) => handleTabChange(key as TabKey)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Secciones personales">
            <Tabs.Tab id="creditos">
              Créditos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="servicios">
              Servicios Básicos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="gastos">
              Gastos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="credenciales">
              Credenciales
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {tab === "creditos" && (
        <Suspense
          fallback={
            <div className="space-y-3">
              <Skeleton className="h-10 w-40 rounded-lg" />
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          }
        >
          <PersonalCreditsPageWrapper />
        </Suspense>
      )}

      {tab === "servicios" && (
        <Suspense
          fallback={
            <div className="space-y-3">
              <Skeleton className="h-10 w-36 rounded-lg" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          }
        >
          <UtilityAccountsTab />
        </Suspense>
      )}

      {tab === "gastos" && (
        <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
          <PersonalGastosTab />
        </Suspense>
      )}

      {tab === "credenciales" && (
        <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
          <ProviderCredentialsTab />
        </Suspense>
      )}
    </div>
  );
}
