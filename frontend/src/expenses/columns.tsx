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

import { ArrowUpDown, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

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
import { SelectCell } from "./select-cell.tsx";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency,
  }).format(amount);
}

export const defaultColumn: Partial<ColumnDef<Expense>> = {
  cell: EditableCell,
};

export const columns: ColumnDef<Expense>[] = [
  {
    id: "select",
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
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Origen
          <ArrowUpDown className="ml-1 h-4 w-4" />
        </Button>
      );
    },
  },

  {
    accessorKey: "date",
    meta: {
      inputType: "date",
      formatValue: (value: unknown) => {
        if (!value) return "";
        return new Date(value as string | number).toISOString().slice(0, 10);
      },
    },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Fecha
          <ArrowUpDown className="ml-1 h-4 w-4" />
        </Button>
      );
    },
  },

  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Nombre
          <ArrowUpDown className="ml-1 h-4 w-4" />
        </Button>
      );
    },
  },

  {
    accessorKey: "installments",
    footer: () => "Total",
    meta: {
      footerClassName: "font-medium",
    },
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Cuotas
          <ArrowUpDown className="ml-1 h-4 w-4" />
        </Button>
      );
    },
  },

  {
    accessorKey: "amount",
    header: "Amount",
    cell: EditableCell,
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
      headerClassName: "text-right",
      cellClassName: "text-right",
      footerClassName: "text-right font-medium",
      inputClassName: "w-full text-right",
      inputType: "text",
      inputMode: "decimal",
      formatValue: (value: unknown, row?: Expense) =>
        formatCurrency(Number(value), row?.currency ?? "ARS"),
    },
  },

  {
    accessorKey: "category",
    cell: SelectCell,
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Categoría
          <ArrowUpDown className="ml-1 h-4 w-4" />
        </Button>
      );
    },
  },

  {
    accessorKey: "usedByTarget",
    cell: SelectCell,
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Usó
          <ArrowUpDown className="ml-1 h-4 w-4" />
        </Button>
      );
    },
  },

  {
    id: "actions",
    meta: {
      headerClassName: "w-8",
      cellClassName: "w-8 whitespace-nowrap",
    },
    cell: ({ row, table }) => {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void table.options.meta?.insertRelativeExpense(row.original.id, "above")}
            >
              Add row above
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => void table.options.meta?.insertRelativeExpense(row.original.id, "below")}
            >
              Add row below
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
