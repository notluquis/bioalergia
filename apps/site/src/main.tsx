import { PostHogProvider } from "@posthog/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import posthog from "posthog-js";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

if (posthogKey && posthogHost) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    person_profiles: "identified_only",
    autocapture: false, // Disable to protect sensitive health data
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Static site: Data doesn't change during session
      staleTime: Infinity, // Never refetch unless explicitly invalidated
      gcTime: 1000 * 60 * 60, // Keep in cache for session duration (1 hour)
      retry: 1, // Only retry once for network failures
      refetchOnWindowFocus: false, // Don't refetch on tab focus
      refetchOnMount: false, // Don't refetch on component remount
      refetchOnReconnect: false, // Don't refetch when regaining connectivity
    },
  },
});

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </QueryClientProvider>,
);
