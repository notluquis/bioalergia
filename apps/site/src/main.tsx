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
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
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
