/* eslint-disable react-refresh/only-export-components */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

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
