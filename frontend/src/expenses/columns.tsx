import "@tanstack/react-table";
import type { ColumnDef, RowData } from "@tanstack/react-table";

/* eslint-disable @typescript-eslint/no-unused-vars */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
    footerClassName?: string;
    inputClassName?: string;
    inputType?: React.HTMLInputTypeAttribute;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    formatValue?: (value: unknown, row?: TData) => string;
  }
  interface TableMeta<TData extends RowData> {
    insertRelativeExpense: (anchorExpenseId: number, position: "above" | "below") => Promise<void>;
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
    selectOptions: Record<string, SelectCellOption[]>;
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */

import type { Expense } from "@server/db/schema";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { SelectCellOption } from "./select-cell.tsx";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.tsx";
import { EditableCell } from "./editable-cell.tsx";
import { parseAmountInput } from "./parse-amount-input.ts";
import { SelectCell } from "./select-cell.tsx";
import { SortableHeader } from "./sortable-header.tsx";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatAmountValue(amount: number, currency: string) {
  const formatted = formatCurrency(amount, currency);
  return currency === "USD" ? `${formatted} USD` : formatted;
}

function formatDateValue(value: unknown) {
  if (!value) return "";

  const date = new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return "";

  const currentYear = new Date().getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    ...(date.getUTCFullYear() === currentYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(date);
}

export const defaultColumn: Partial<ColumnDef<Expense>> = {
  cell: EditableCell,
};

export const columns: ColumnDef<Expense>[] = [
  {
    id: "select",
    meta: {
      headerClassName: "w-8",
      cellClassName: "w-8 whitespace-nowrap",
    },
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
  },
  {
    accessorKey: "origin",
    meta: {
      headerClassName: "w-18",
      cellClassName: "break-words",
      inputClassName: "w-full min-w-0 bg-transparent text-sm",
    },
    header: ({ column }) => <SortableHeader column={column} label="Origen" />,
  },

  {
    accessorKey: "date",
    meta: {
      headerClassName: "w-32 whitespace-nowrap",
      cellClassName: "whitespace-nowrap",
      inputClassName: "w-full min-w-0 bg-transparent text-sm text-left",
      inputType: "date",
      formatValue: formatDateValue,
    },
    header: ({ column }) => <SortableHeader column={column} label="Fecha" />,
  },

  {
    accessorKey: "title",
    meta: {
      headerClassName: "w-auto",
      cellClassName: "w-auto break-words",
      inputClassName: "w-full min-w-0 bg-transparent text-sm",
    },
    header: ({ column }) => <SortableHeader column={column} label="Nombre" />,
  },
  {
    accessorKey: "amount",
    header: ({ column }) => <SortableHeader column={column} label="Amount" />,
    cell: (context) => (
      <div className={cn(context.row.original.currency === "USD" && "text-green-600")}>
        <EditableCell {...context} />
      </div>
    ),
    footer: ({ table }) => {
      const totalsByCurrency = table
        .getRowModel()
        .rows.reduce<Record<string, number>>((totals, row) => {
          const currency = row.original.currency ?? "ARS";
          totals[currency] = (totals[currency] ?? 0) + Number(row.original.amount ?? 0);
          return totals;
        }, {});

      return (
        <div className="space-y-1">
          {Object.entries(totalsByCurrency).map(([currency, total]) => (
            <div key={currency}>{formatCurrency(total, currency)}</div>
          ))}
        </div>
      );
    },
    meta: {
      headerClassName: "w-24 whitespace-nowrap text-right",
      cellClassName: "whitespace-nowrap text-right",
      footerClassName: "text-right font-medium",
      inputClassName: "w-full text-right",
      inputType: "text",
      inputMode: "decimal",
      formatValue: (value: unknown, row?: Expense) => {
        const parsed = parseAmountInput(value);
        return formatAmountValue(parsed.amount, parsed.currency ?? row?.currency ?? "ARS");
      },
    },
  },

  {
    accessorKey: "installments",
    footer: () => "Total",
    meta: {
      headerClassName: "w-20 whitespace-nowrap text-right",
      cellClassName: "whitespace-nowrap text-right",
      footerClassName: "font-medium whitespace-nowrap",
      inputClassName: "w-full min-w-0 bg-transparent text-sm text-right",
    },
    header: ({ column }) => <SortableHeader column={column} label="Cuotas" />,
  },

  {
    accessorKey: "category",
    cell: SelectCell,
    meta: {
      headerClassName: "w-28",
      cellClassName: "whitespace-nowrap",
    },
    header: ({ column }) => <SortableHeader column={column} label="Categoría" />,
  },

  {
    accessorKey: "usedByTarget",
    cell: SelectCell,
    meta: {
      headerClassName: "w-20",
      cellClassName: "whitespace-nowrap",
    },
    header: ({ column }) => <SortableHeader column={column} label="Usó" />,
  },

  {
    id: "actions",
    meta: {
      headerClassName: "w-10",
      cellClassName: "w-10 whitespace-nowrap",
    },
    cell: ({ row, table }) => {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                void table.options.meta?.insertRelativeExpense(row.original.id, "above")
              }
            >
              Add row above
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                void table.options.meta?.insertRelativeExpense(row.original.id, "below")
              }
            >
              Add row below
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
