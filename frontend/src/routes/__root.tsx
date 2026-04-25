import { useSession } from "@better-auth-ui/react";
import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";

import { Providers } from "@/components/providers";
import { UserButton } from "@/components/user/user-button";
// import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: RootErrorComponent,
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

function RootErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-4xl flex-col gap-4 px-4 py-8">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <h1 className="text-lg font-semibold">App boot failed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is the error that was previously showing up as a white screen.
        </p>
        <pre className="mt-4 overflow-auto rounded-md bg-background p-3 text-sm text-destructive">
          {error.message}
        </pre>
        <Button className="mt-4" variant="outline" onClick={() => reset()}>
          Retry
        </Button>
      </div>
    </div>
  );
}
