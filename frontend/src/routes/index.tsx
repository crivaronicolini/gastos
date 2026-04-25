import { useSession } from "@better-auth-ui/react";
/* eslint-disable react-refresh/only-export-components */
import { viewPaths } from "@better-auth-ui/react/core";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency,
  }).format(amount);
}

export const Route = createFileRoute("/")({
  component: Index,
});

async function getTotalSpent() {
  const res = await api.expenses["total-spent"].$get();
  if (!res.ok) {
    throw new Error("server error");
  }
  const data = await res.json();
  return { totals: data.total };
}

function Index() {
  const { data: session, isPending: sessionPending } = useSession();

  if (sessionPending) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;
  }

  if (!session?.session) {
    return <LandingPage />;
  }

  return <AuthenticatedHome />;
}

function LandingPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-5xl items-center px-4 py-12">
      <div className="grid gap-8 md:grid-cols-[minmax(0,1.25fr)_minmax(18rem,24rem)] md:items-center">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Gastos
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Shared expense tracking without the spreadsheet drift.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Upload statements, review categorized expenses, and keep group spending in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={`/auth/${viewPaths.auth.signIn}`}>Sign in</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={`/auth/${viewPaths.auth.signUp}`}>Create account</Link>
            </Button>
          </div>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>What you get</CardTitle>
            <CardDescription>
              Built for quickly reviewing and organizing shared spending.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground">Statement uploads</p>
              <p>Drop in PDFs and track processing status without leaving the app.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Expense review</p>
              <p>Edit, categorize, and clean up imported expenses from a single table.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Group visibility</p>
              <p>Keep members, targets, and totals tied to the same shared workspace.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function AuthenticatedHome() {
  const { isPending, error, data } = useQuery({
    queryKey: ["get-total-spent"],
    queryFn: getTotalSpent,
  });

  if (error) return "An error has ocurred: " + error.message;

  return (
    <Card className="w-full max-w-sm m-auto">
      <CardHeader>
        <CardTitle>Total Gastado</CardTitle>
        <CardDescription>Total que gastaste.</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending
          ? "..."
          : data.totals.map((item: { currency: string; total: string | number | null }) => (
              <div key={item.currency}>
                {formatCurrency(Number(item.total ?? 0), item.currency)}
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
