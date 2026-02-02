import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Static site: Data doesn't change during session
      staleTime: Number.POSITIVE_INFINITY, // Never refetch unless explicitly invalidated
      gcTime: 1000 * 60 * 60, // Keep in cache for session duration (1 hour)
      retry: 1, // Only retry once for network failures
      refetchOnWindowFocus: false, // Don't refetch on tab focus
      refetchOnMount: false, // Don't refetch on component remount
      refetchOnReconnect: false, // Don't refetch when regaining connectivity
    },
  },
});

const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  person_profiles: "identified_only",
  autocapture: false, // Disable to protect sensitive health data
} as const;

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <PostHogProvider apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY} options={posthogOptions}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </PostHogProvider>
  </StrictMode>,
);
