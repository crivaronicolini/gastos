import type { Expense } from "@server/db/schema";
import type { CellContext } from "@tanstack/react-table";

import React from "react";

function toDateInputValue(value: unknown) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function EditableCell({ getValue, row, column, table }: CellContext<Expense, unknown>) {
  const initialValue = getValue();
  const [value, setValue] = React.useState(initialValue);
  const [isEditing, setIsEditing] = React.useState(false);

  const formatValue = column.columnDef.meta?.formatValue;
  const isDateInput = column.columnDef.meta?.inputType === "date";
  const inputClassName =
    column.columnDef.meta?.inputClassName ?? "w-full min-w-0 bg-transparent text-sm";

  const inputValue =
    isDateInput && isEditing
      ? toDateInputValue(value)
      : formatValue && !isEditing
        ? formatValue(value, row.original)
        : String(value ?? "");

  const onBlur = () => {
    setIsEditing(false);
    if (value === initialValue) return;
    table.options.meta?.updateData(row.original.id, column.id, value);
  };

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (isDateInput && !isEditing) {
    return (
      <button
        type="button"
        className={inputClassName}
        onClick={() => setIsEditing(true)}
      >
        {inputValue || "\u00A0"}
      </button>
    );
  }

  return (
    <input
      className={inputClassName}
      type={column.columnDef.meta?.inputType ?? "text"}
      inputMode={column.columnDef.meta?.inputMode}
      value={inputValue}
      autoFocus={isDateInput}
      onFocus={() => {
        setIsEditing(true);
      }}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
    />
  );
}
