import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";

import { Card, CardContent } from "@/components/ui/card";

type ExpensePeriodDatum = {
  hasData: boolean;
  period: string;
  label: string;
  total: number;
};

type ExpensePeriodChartProps = {
  data: ExpensePeriodDatum[];
  selectedPeriod: string | null;
  onPeriodSelect: (period: string) => void;
  currency: string | null;
};

function formatChartValue(value: number, currency: string | null) {
  if (!Number.isFinite(value)) return "-";
  if (!currency) return new Intl.NumberFormat("es-AR").format(value);

  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function getCurrentPeriod() {
  return new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date());
}

export function ExpensePeriodChart({
  data,
  selectedPeriod,
  onPeriodSelect,
  currency,
}: ExpensePeriodChartProps) {
  const activeIndex = React.useMemo(
    () => data.findIndex((item) => item.period === selectedPeriod),
    [data, selectedPeriod],
  );
  const currentPeriod = React.useMemo(() => getCurrentPeriod(), []);
  const hasAnyExpenses = React.useMemo(() => data.some((item) => item.total > 0), [data]);

  return (
    <Card className="bg-background">
      <CardContent className={hasAnyExpenses ? "pt-6" : "py-0"}>
        {hasAnyExpenses && (
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                barCategoryGap={10}
                margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" opacity={0.35} />
                <XAxis axisLine={false} dataKey="label" tick={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;

                    const item = payload[0]?.payload as ExpensePeriodDatum | undefined;
                    if (!item) return null;

                    return (
                      <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                        <div className="font-medium text-foreground">{item.label}</div>
                        <div className="text-muted-foreground">
                          {formatChartValue(item.total, currency)}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="total"
                  maxBarSize={28}
                  onClick={(entry) => {
                    if (entry?.period) onPeriodSelect(entry.period);
                  }}
                  radius={[8, 8, 0, 0]}
                >
                  {data.map((entry, index) => {
                    const isCurrentMonth = entry.period === currentPeriod;
                    const isFuture = entry.period > currentPeriod;
                    const fill = isFuture
                      ? "hsl(var(--muted-foreground) / 0.22)"
                      : index === activeIndex || isCurrentMonth
                        ? "hsl(var(--primary))"
                        : entry.hasData
                          ? "hsl(var(--foreground) / 0.72)"
                          : "rgba(0, 0, 0, 0)";

                    return <Cell key={entry.period} cursor="pointer" fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className={`grid grid-cols-12 gap-1 ${hasAnyExpenses ? "mt-2" : ""}`}>
          {data.map((entry) => {
            const isActive = entry.period === selectedPeriod;
            const isCurrentMonth = entry.period === currentPeriod;
            const isFuture = entry.period > currentPeriod;
            const color = isFuture
              ? "rgba(255, 255, 255, 0.4)"
              : isActive || isCurrentMonth
                ? "hsl(var(--primary))"
                : "rgba(255, 255, 255, 0.92)";

            return (
              <button
                key={entry.period}
                type="button"
                className="cursor-pointer text-center text-[11px]"
                style={{
                  color,
                  fontWeight: isActive || isCurrentMonth ? 700 : 500,
                  textDecoration: isCurrentMonth ? "underline" : undefined,
                }}
                onClick={() => onPeriodSelect(entry.period)}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
