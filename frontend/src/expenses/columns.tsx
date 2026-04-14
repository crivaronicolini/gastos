import "@tanstack/react-table";
import type { ColumnDef, RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    headerClassName?: string;
    cellClassName?: string;
    inputClassName?: string;
    inputType?: React.HTMLInputTypeAttribute;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    formatValue?: (value: unknown) => string;
  }
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
    categories: Category[];
  }
}

import type { Category, Expense } from "@server/db/schema";

import { ArrowUpDown, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.tsx";
import { CategoryCell } from "./category-cell.tsx";
import { EditableCell } from "./editable-cell.tsx";

export const defaultColumn: Partial<ColumnDef<Expense>> = {
  cell: EditableCell,
};

export const columns: ColumnDef<Expense>[] = [
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
      formatValue: (value) => {
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
    meta: {
      headerClassName: "text-right",
      cellClassName: "text-right",
      inputClassName: "w-full text-right",
      inputType: "text",
      inputMode: "decimal",
      formatValue: (value) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(Number(value)),
    },
  },

  {
    accessorKey: "category",
    cell: CategoryCell,
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
    accessorKey: "usedBy",
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
    accessorKey: "paidBy",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Pagó
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
    cell: () => {
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
            <DropdownMenuItem>Accion 1</DropdownMenuItem>
            <DropdownMenuItem>Accion 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
