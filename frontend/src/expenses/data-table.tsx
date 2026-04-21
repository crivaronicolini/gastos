import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps {
  columns: ColumnDef<Expense>[];
  data: Expense[];
  selectOptions: Record<string, SelectCellOption[]>;
  onUpdateData: (expenseId: number, columnId: string, value: unknown) => void;
  onDeleteExpenses: (expenseIds: number[]) => Promise<void>;
  isDeletingExpenses?: boolean;
}

import type { Expense } from "@server/db/schema";

import type { SelectCellOption } from "./select-cell.tsx";

import { defaultColumn } from "./columns.tsx";

export function DataTable({
  columns,
  data,
  selectOptions,
  onUpdateData,
  onDeleteExpenses,
  isDeletingExpenses = false,
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    defaultColumn,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      rowSelection,
    },
    meta: {
      updateData: onUpdateData,
      selectOptions,
    },
  });

  const selectedExpenseIds = table.getSelectedRowModel().rows.map((row) => row.original.id);

  async function handleDeleteSelected() {
    if (selectedExpenseIds.length === 0) return;
    await onDeleteExpenses(selectedExpenseIds);
    setRowSelection({});
  }

  return (
    <div className="overflow-hidden rounded-md border">
      {selectedExpenseIds.length > 0 && (
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            {selectedExpenseIds.length} selected
          </p>
          <Button
            variant="destructive"
            size="sm"
            disabled={isDeletingExpenses}
            onClick={() => void handleDeleteSelected()}
          >
            Delete selected
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead
                    key={header.id}
                    className={header.column.columnDef.meta?.headerClassName}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cell.column.columnDef.meta?.cellClassName}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          {table.getFooterGroups().map((footerGroup) => (
            <TableRow key={footerGroup.id}>
              {footerGroup.headers.map((header) => (
                <TableCell
                  key={header.id}
                  className={header.column.columnDef.meta?.footerClassName}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.footer, header.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableFooter>
      </Table>
    </div>
  );
}
