import type { Expense } from "@server/db/schema";
import type { CellContext } from "@tanstack/react-table";
import * as React from "react";

export function CategoryCell({ getValue, row, column, table }: CellContext<Expense, unknown>) {
  const value = getValue();
  const [selectedValue, setSelectedValue] = React.useState(value == null ? "" : String(value));
  const categories = table.options.meta?.categories ?? [];

  React.useEffect(() => {
    setSelectedValue(value == null ? "" : String(value));
  }, [value]);

  return (
    <select
      value={selectedValue}
      onChange={(e) => {
        const nextValue = e.target.value;
        setSelectedValue(nextValue);
        table.options.meta?.updateData(row.original.id, column.id, nextValue);
      }}
    >
      <option value="">No category</option>

      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}
