import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";

import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { routeTree } from "./routeTree.gen";

const darkModeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

function applySystemTheme(event?: MediaQueryList | MediaQueryListEvent) {
  document.documentElement.classList.toggle("dark", event?.matches ?? darkModeMediaQuery.matches);
}

applySystemTheme(darkModeMediaQuery);
darkModeMediaQuery.addEventListener("change", applySystemTheme);

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

// Register things for typesafety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

queryClient.setQueryDefaults(["auth"], {
  gcTime: 30 * 60 * 1000,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  staleTime: 5 * 60 * 1000,
});
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
