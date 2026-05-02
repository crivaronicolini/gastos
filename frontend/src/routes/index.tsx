import { useSession } from "@better-auth-ui/react";
/* eslint-disable react-refresh/only-export-components */
import { viewPaths } from "@better-auth-ui/react/core";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BarChart, BarList, DonutChart } from "@tremor/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type ExpenseWithStatementPeriod = {
  amount: number | null;
  category: number | null;
  currency: string;
  date: string | null;
  id: number;
  installments: string | null;
  origin: string;
  statement: number | null;
  statementGroupId: number | null;
  statementMonth: string | null;
  statementOwnerId: number | null;
  title: string;
  usedByTarget: number | null;
};

type Category = {
  id: number;
  name: string;
};

type Group = {
  id: number;
  members: Array<{
    id: number;
    group: number | null;
    role: string;
    user: {
      id: number;
      name: string;
    };
  }>;
  usageTargets: Array<{
    id: number;
    group: number | null;
    name: string;
    type: string;
    user: number | null;
  }>;
  name: string;
};

type DashboardCurrencySlice = {
  currency: string;
  total: number;
};

type MonthlyDashboardRow = {
  period: string;
  label: string;
  total: number;
  [key: string]: number | string;
};

type CategoryBreakdownRow = {
  name: string;
  total: number;
  average: number;
};

type SpendByPersonRow = {
  name: string;
  value: number;
  color: string;
};

type DashboardCharts = {
  categories: Category[];
  group: Group | null;
  monthlyByCurrency: Record<string, MonthlyDashboardRow[]>;
  expenses: ExpenseWithStatementPeriod[];
  topCategoriesByCurrency: Record<string, CategoryBreakdownRow[]>;
  spendByTargetByCurrency: Record<string, SpendByPersonRow[]>;
  totalsByCurrency: DashboardCurrencySlice[];
};

const TREMOR_COLORS = ["blue", "cyan", "indigo", "violet", "amber", "emerald", "rose"];
const LEGEND_SWATCHES = [
  "bg-blue-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
];

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatChartCurrency(amount: number, currency: string | null) {
  if (!currency) return new Intl.NumberFormat("es-AR").format(amount);
  return formatCurrency(amount, currency);
}

function formatPeriodLabel(period: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${period}-01T00:00:00Z`));
}

function getCurrentPeriod() {
  return new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date());
}

function buildRollingPeriods(currentPeriod: string, monthsAfterCurrent = 0, totalMonths = 12) {
  const [year, month] = currentPeriod.split("-").map(Number);
  const currentIndex = totalMonths - monthsAfterCurrent - 1;
  const start = new Date(Date.UTC(year, month - 1 - currentIndex, 1));

  return Array.from({ length: totalMonths }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const nextYear = date.getUTCFullYear();
    const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${nextYear}-${nextMonth}`;
  });
}

function getColor(index: number) {
  return TREMOR_COLORS[index % TREMOR_COLORS.length];
}

async function getDashboardData(): Promise<DashboardCharts> {
  const [expensesRes, categoriesRes, groupsRes] = await Promise.all([
    api.expenses.$get(),
    api.categories.$get(),
    api.groups.$get(),
  ]);

  if (!expensesRes.ok || !categoriesRes.ok || !groupsRes.ok) {
    throw new Error("server error");
  }

  const expensesData = (await expensesRes.json()) as { expenses: ExpenseWithStatementPeriod[] };
  const categoriesData = (await categoriesRes.json()) as { categories: Category[] };
  const groupsData = (await groupsRes.json()) as { groups: Group[] };

  const group = groupsData.groups[0] ?? null;
  const categories = categoriesData.categories;
  const currentPeriod = getCurrentPeriod();
  const rollingPeriods = buildRollingPeriods(currentPeriod);
  const expenses = expensesData.expenses.filter((expense) => expense.statementGroupId === group?.id);

  const totalsByCurrency = new Map<string, number>();
  const monthlyByCurrency = new Map<string, Map<string, number>>();
  const categoryTotalsByCurrency = new Map<string, Map<string, number>>();
  const targetTotalsByCurrency = new Map<string, Map<string, number>>();
  const categoryNamesById = new Map(categories.map((category) => [category.id, category.name]));
  const targetNamesById = new Map((group?.usageTargets ?? []).map((target) => [target.id, target.name]));

  for (const expense of expenses) {
    if (expense.amount == null) continue;

    const currency = expense.currency;
    const amount = Number(expense.amount);
    const month = expense.statementMonth;
    const categoryName =
      expense.category == null ? "Uncategorized" : categoryNamesById.get(expense.category) ?? "Uncategorized";
    const targetName =
      expense.usedByTarget == null ? "Unassigned" : targetNamesById.get(expense.usedByTarget) ?? "Unassigned";

    totalsByCurrency.set(currency, (totalsByCurrency.get(currency) ?? 0) + amount);

    if (month) {
      const monthlyCurrency = monthlyByCurrency.get(currency) ?? new Map<string, number>();
      monthlyCurrency.set(month, (monthlyCurrency.get(month) ?? 0) + amount);
      monthlyByCurrency.set(currency, monthlyCurrency);
    }

    const categoryCurrency = categoryTotalsByCurrency.get(currency) ?? new Map<string, number>();
    categoryCurrency.set(categoryName, (categoryCurrency.get(categoryName) ?? 0) + amount);
    categoryTotalsByCurrency.set(currency, categoryCurrency);

    const targetCurrency = targetTotalsByCurrency.get(currency) ?? new Map<string, number>();
    targetCurrency.set(targetName, (targetCurrency.get(targetName) ?? 0) + amount);
    targetTotalsByCurrency.set(currency, targetCurrency);
  }

  const monthlyByCurrencyRows: DashboardCharts["monthlyByCurrency"] = {};
  const topCategoriesByCurrency: DashboardCharts["topCategoriesByCurrency"] = {};
  const spendByTargetByCurrency: DashboardCharts["spendByTargetByCurrency"] = {};

  const sortedCurrencies = Array.from(totalsByCurrency.entries()).sort((a, b) => b[1] - a[1]);

  for (const [currency] of sortedCurrencies) {
    const monthlyTotals = monthlyByCurrency.get(currency) ?? new Map<string, number>();
    const categoryTotals = categoryTotalsByCurrency.get(currency) ?? new Map<string, number>();
    const targetTotals = targetTotalsByCurrency.get(currency) ?? new Map<string, number>();
    const topCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const categoryKeys = topCategories.length > 0 ? topCategories.map(([name]) => name) : ["Uncategorized"];

    monthlyByCurrencyRows[currency] = rollingPeriods.map((period) => {
      const row: MonthlyDashboardRow = {
        period,
        label: formatPeriodLabel(period),
        total: monthlyTotals.get(period) ?? 0,
      };

      let other = 0;
      for (const expense of expenses) {
        if (expense.currency !== currency) continue;
        if (expense.statementMonth !== period) continue;
        if (expense.amount == null) continue;

        const resolvedName =
          expense.category == null ? "Uncategorized" : categoryNamesById.get(expense.category) ?? "Uncategorized";
        const amount = Number(expense.amount);

        if (categoryKeys.includes(resolvedName)) {
          row[resolvedName] = (row[resolvedName] as number | undefined ?? 0) + amount;
        } else {
          other += amount;
        }
      }

      row.Other = other;
      return row;
    });

    topCategoriesByCurrency[currency] = topCategories.length > 0
      ? topCategories.map(([name, total]) => ({ name, total, average: total / 12 }))
      : [];

    spendByTargetByCurrency[currency] = Array.from(targetTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({
        name,
        value,
        color: getColor(index),
      }));
  }

  return {
    categories,
    expenses,
    group,
    monthlyByCurrency: monthlyByCurrencyRows,
    spendByTargetByCurrency,
    topCategoriesByCurrency,
    totalsByCurrency: sortedCurrencies.map(([currency, total]) => ({
      currency,
      total,
    })),
  };
}

export const Route = createFileRoute("/")({
  component: Index,
});

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

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-h-[24rem]">
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[20rem]">{children}</CardContent>
    </Card>
  );
}

function LoadingDashboard() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 p-4 md:p-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-[26rem] rounded-xl" />
        <Skeleton className="h-[26rem] rounded-xl" />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function AuthenticatedHome() {
  const { isPending, error, data } = useQuery({
    queryKey: ["dashboard-data"],
    queryFn: getDashboardData,
    staleTime: 1000 * 60,
  });

  if (isPending) {
    return <LoadingDashboard />;
  }

  if (error) return "An error has ocurred: " + error.message;

  const currencies = data?.totalsByCurrency ?? [];
  const primaryCurrency = currencies[0]?.currency ?? null;
  const stackedData = primaryCurrency ? data?.monthlyByCurrency[primaryCurrency] ?? [] : [];
  const pieData = primaryCurrency ? data?.topCategoriesByCurrency[primaryCurrency] ?? [] : [];
  const peopleData = primaryCurrency ? data?.spendByTargetByCurrency[primaryCurrency] ?? [] : [];
  const stackedCategories = pieData.map((entry) => entry.name);
  const stackedSeries = [...stackedCategories, "Other"];

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 p-4 md:p-6">
      <div className="grid gap-4 md:grid-cols-3">
        {(currencies.length > 0 ? currencies : [{ currency: "ARS", total: 0 }]).map((item) => (
          <Card key={item.currency}>
            <CardHeader className="pb-2">
              <CardDescription>Total spent</CardDescription>
              <CardTitle>{formatCurrency(item.total, item.currency)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {item.currency === primaryCurrency ? "Primary dashboard currency" : "Currency total"}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Monthly spend by category"
          description="Stacked monthly totals for the primary currency."
        >
          {stackedData.length > 0 ? (
            <BarChart
              className="h-full"
              data={stackedData}
              index="label"
              categories={stackedSeries}
              colors={stackedSeries.map((_, index) => getColor(index))}
              valueFormatter={(value) => formatChartCurrency(value, primaryCurrency)}
              yAxisWidth={72}
              stack
              showLegend={false}
              showGridLines={false}
              showAnimation
            />
          ) : (
            <EmptyState message="No monthly expense data yet." />
          )}
        </ChartCard>

        <ChartCard
          title="Top categories"
          description="Average monthly spend over the last 12 months."
        >
          {pieData.length > 0 ? (
            <div className="flex h-full flex-col gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {pieData.map((entry, index) => (
                  <div
                    key={entry.name}
                    className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs"
                  >
                    <span
                      className={`mt-0.5 size-2.5 shrink-0 rounded-sm ${LEGEND_SWATCHES[index % LEGEND_SWATCHES.length]}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{entry.name}</p>
                      <p className="text-muted-foreground">{formatChartCurrency(entry.average, primaryCurrency)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <DonutChart
                className="h-full"
                data={pieData}
                index="name"
                category="average"
                colors={pieData.map((_, index) => getColor(index))}
                variant="donut"
                valueFormatter={(value) => formatChartCurrency(value, primaryCurrency)}
                showLabel
                showAnimation
              />
            </div>
          ) : (
            <EmptyState message="No category breakdown available yet." />
          )}
        </ChartCard>

        <ChartCard
          title="Spend by person"
          description="Total spend assigned to each group member or usage target."
        >
          {peopleData.length > 0 ? (
            <BarList
              className="mt-4"
              data={peopleData.slice(0, 8)}
              valueFormatter={(value) => formatChartCurrency(value, primaryCurrency)}
              sortOrder="descending"
            />
          ) : (
            <EmptyState message="No per-person allocations yet." />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
