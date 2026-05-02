import { useSession } from "@better-auth-ui/react";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";

import { Providers } from "@/components/providers";
import { UserButton } from "@/components/user/user-button";
// import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <Providers>
          <AppShell />
          <Outlet />
          {/* <TanStackRouterDevtools position="bottom-right" /> */}
        </Providers>
      </ThemeProvider>
    </>
  );
}

function AppShell() {
  const { data: session } = useSession();

  if (!session?.session) {
    return null;
  }

  return (
    <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center border-b p-2 text-lg">
      <div />
      <nav className="flex items-center justify-center gap-4">
        <Link
          to="/"
          activeProps={{
            className: "font-bold",
          }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>
        <Link
          to="/expenses"
          activeProps={{
            className: "font-bold",
          }}
        >
          Expenses
        </Link>
      </nav>
      <div className="justify-self-end">
        <UserButton size="icon" />
      </div>
    </div>
  );
}
