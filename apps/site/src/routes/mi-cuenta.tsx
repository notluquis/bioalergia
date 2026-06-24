import { Skeleton } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AccountLayoutView } from "@/features/account/components/AccountLayoutView";
import { accountKeys } from "@/features/account/queries";
import { siteAuthClient } from "@/lib/orpc-client";

function MiCuentaLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const meQuery = useQuery(accountKeys.me());

  const logoutMutation = useMutation({
    mutationFn: () => siteAuthClient.logout(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
      navigate({ to: "/" });
    },
  });

  useEffect(() => {
    if (
      meQuery.isSuccess &&
      !meQuery.data.user &&
      !location.pathname.startsWith("/mi-cuenta/auth/")
    ) {
      navigate({ to: "/login", replace: true });
    }
  }, [meQuery.isSuccess, meQuery.data, location.pathname, navigate]);

  if (meQuery.isLoading) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  // Auth callback handles its own loading state without the layout shell —
  // render the Outlet directly so the redirect to /mi-cuenta isn't blocked
  // by the "no user" guard above.
  if (location.pathname.startsWith("/mi-cuenta/auth/")) {
    return <Outlet />;
  }

  if (!meQuery.data?.user) {
    return null; // redirect in-flight
  }

  const user = meQuery.data.user;

  return (
    <AccountLayoutView
      activePath={location.pathname}
      isLoggingOut={logoutMutation.isPending}
      onLogout={() => logoutMutation.mutate()}
      user={user}
    >
      <Outlet />
    </AccountLayoutView>
  );
}

export const Route = createFileRoute("/mi-cuenta")({
  component: MiCuentaLayout,
});
