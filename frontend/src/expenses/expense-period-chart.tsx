import * as React from "react";
import { BarChart } from "@tremor/react";

import { Card, CardContent } from "@/components/ui/card";

type ExpensePeriodDatum = {
  hasData: boolean;
  period: string;
  label: string;
  total: number;
  [ownerName: string]: boolean | number | string;
};

type ExpensePeriodChartProps = {
  categories: string[];
  colors: string[];
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
  categories,
  colors,
  data,
  selectedPeriod,
  onPeriodSelect,
  currency,
}: ExpensePeriodChartProps) {
  const currentPeriod = React.useMemo(() => getCurrentPeriod(), []);
  const hasAnyExpenses = React.useMemo(() => data.some((item) => item.total > 0), [data]);

  return (
    <Card className="bg-background">
      <CardContent className={hasAnyExpenses ? "pt-6" : "py-0"}>
        {hasAnyExpenses && (
          <div className="h-28 w-full">
            <BarChart
              className="h-full"
              data={data}
              index="label"
              categories={categories}
              colors={colors}
              valueFormatter={(value) => formatChartValue(value, currency)}
              showYAxis={false}
              padding={{ left: 0, right: 0 }}
              showXAxis={false}
              showLegend={false}
              showGridLines={false}
              showAnimation
              stack
              barCategoryGap={10}
              onValueChange={(value) => {
                if (typeof value?.period === "string") onPeriodSelect(value.period);
              }}
            />
          </div>
        )}
        <div
          className={`grid grid-cols-12 gap-1 ${hasAnyExpenses ? "mt-4" : ""}`}
        >
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
                className="cursor-pointer rounded-full px-1.5 py-1 text-center text-[11px] transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
