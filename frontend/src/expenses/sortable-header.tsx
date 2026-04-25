import type { Column } from "@tanstack/react-table";

import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";

type SortableHeaderProps<TData> = {
  column: Column<TData>;
  label: string;
};

export function SortableHeader<TData>({ column, label }: SortableHeaderProps<TData>) {
  const sort = column.getIsSorted();

  return (
    <Button
      className="h-7 gap-1 px-2 text-xs"
      variant="ghost"
      size="xs"
      onClick={() => column.toggleSorting(sort === "asc")}
    >
      {label}
      {sort === "asc" && <ChevronUp className="size-4" />}
      {sort === "desc" && <ChevronDown className="size-4" />}
    </Button>
  );
}
