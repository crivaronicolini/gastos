import type { Expense } from "@server/db/schema";
import type { CellContext } from "@tanstack/react-table";

import * as React from "react";

export type SelectCellOption = {
  id: string | number;
  name: string;
};

export function SelectCell({ getValue, row, column, table }: CellContext<Expense, unknown>) {
  const value = getValue();
  const [selectedValue, setSelectedValue] = React.useState(value == null ? "" : String(value));
  const options = table.options.meta?.selectOptions?.[column.id] ?? [];

  React.useEffect(() => {
    setSelectedValue(value == null ? "" : String(value));
  }, [value]);

  return (
    <select
      className="w-full min-w-0 bg-transparent text-sm"
      value={selectedValue}
      onChange={(e) => {
        const nextValue = e.target.value;
        setSelectedValue(nextValue);
        table.options.meta?.updateData(row.original.id, column.id, nextValue);
      }}
    >
      <option value="">None</option>

      {options.map((option: SelectCellOption) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}
