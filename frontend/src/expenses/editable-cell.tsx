import type { Expense } from "@server/db/schema";
import type { CellContext } from "@tanstack/react-table";

import React from "react";

export function EditableCell({ getValue, row, column, table }: CellContext<Expense, unknown>) {
  const initialValue = getValue();
  const [value, setValue] = React.useState(initialValue);
  const [isEditing, setIsEditing] = React.useState(false);

  const formatValue = column.columnDef.meta?.formatValue;

  const isDateInput = column.columnDef.meta?.inputType === "date";

  const inputValue =
    formatValue && (!isEditing || isDateInput) ? formatValue(value) : String(value ?? "");

  const onBlur = () => {
    setIsEditing(false);
    if (value === initialValue) return;
    table.options.meta?.updateData(row.original.id, column.id, value);
  };

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <input
      className={column.columnDef.meta?.inputClassName}
      type={column.columnDef.meta?.inputType ?? "text"}
      inputMode={column.columnDef.meta?.inputMode}
      value={inputValue}
      onFocus={() => {
        setIsEditing(true);
      }}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
    />
  );
}
