import "@glideapps/glide-data-grid/dist/index.css";
import "@glideapps/glide-data-grid-cells/dist/index.css";
import "./data-table.css";
import type { Expense } from "@server/db/schema";

import {
  CompactSelection,
  DataEditor,
  GridCellKind,
  TextCellEntry,
  getDefaultTheme,
  type CustomCell,
  type CustomRenderer,
  type DataEditorRef,
  type EditableGridCell,
  type GridCell,
  type GridColumn,
  type GridSelection,
  type Item,
  type Theme,
  useTheme,
} from "@glideapps/glide-data-grid";
import { DropdownCell, type DropdownCellType } from "@glideapps/glide-data-grid-cells";
import { Plus, X } from "lucide-react";
import * as React from "react";
import Select from "react-select";

import { Button } from "@/components/ui/button";
import { useDeleteExpenses } from "@/expenses/use-delete-expenses";

import type { SelectCellOption } from "./select-cell.tsx";

import { parseAmountInput } from "./parse-amount-input.ts";

interface DataTableProps {
  data: Expense[];
  onAddExpense: () => Promise<void>;
  selectOptions: Record<string, SelectCellOption[]>;
  onUpdateData: (expenseId: number, columnId: string, value: unknown) => void;
}

type SortableColumnId =
  | "origin"
  | "date"
  | "title"
  | "amount"
  | "installments"
  | "category"
  | "usedByTarget";

type SortState = {
  column: SortableColumnId;
  direction: "asc" | "desc";
} | null;

const SORTABLE_COLUMNS = new Set<SortableColumnId>([
  "origin",
  "date",
  "title",
  "amount",
  "installments",
  "category",
  "usedByTarget",
]);

const COLUMN_IDS: SortableColumnId[] = [
  "origin",
  "date",
  "title",
  "amount",
  "installments",
  "category",
  "usedByTarget",
];

const COLUMN_LABELS: Record<SortableColumnId, string> = {
  amount: "Amount",
  category: "Categoría",
  date: "Fecha",
  installments: "Cuotas",
  origin: "Origen",
  title: "Nombre",
  usedByTarget: "Usó",
};

const BASE_COLUMN_WIDTHS: Record<SortableColumnId, number> = {
  amount: 104,
  category: 96,
  date: 86,
  installments: 64,
  origin: 62,
  title: 180,
  usedByTarget: 74,
};

const GRID_THEME: Theme = {
  ...getDefaultTheme(),
  // Glide blends canvas colors internally and v6 does not reliably parse CSS Color 4
  // space-separated oklch() values. Use RGB/RGBA tokens for deterministic repainting.
  accentColor: "rgba(190, 190, 190, 0.72)",
  accentFg: "#171717",
  accentLight: "rgba(145, 145, 145, 0.04)",
  bgCell: "#171717",
  bgCellMedium: "#1c1c1c",
  bgHeader: "#2a2a2a",
  bgHeaderHasFocus: "rgba(46, 46, 46, 0.78)",
  bgHeaderHovered: "rgba(46, 46, 46, 0.78)",
  borderColor: "rgba(255, 255, 255, 0.10)",
  textDark: "#fafafa",
  textHeader: "#fafafa",
  textHeaderSelected: "#171717",
  textLight: "#b4b4b4",
  textMedium: "#8e8e8e",
};

const EMPTY_SELECTION: GridSelection = {
  columns: CompactSelection.empty(),
  rows: CompactSelection.empty(),
};

let activeSearchTableId: string | null = null;

function isSortableColumn(columnId: SortableColumnId): columnId is SortableColumnId {
  return SORTABLE_COLUMNS.has(columnId);
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    currency,
    style: "currency",
  }).format(amount);
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

function toDateTextValue(value: unknown) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function getSelectDisplay(value: unknown, options: SelectCellOption[]) {
  if (value == null || value === "") return "";
  const selected = options.find((option) => String(option.id) === String(value));
  return selected?.name ?? String(value);
}

function makeTextCell(
  data: string,
  displayData = data,
  align: GridCell["contentAlign"] = "left",
  readonly = false,
): GridCell {
  return {
    allowOverlay: !readonly,
    contentAlign: align,
    copyData: data,
    data,
    displayData,
    kind: GridCellKind.Text,
    readonly,
  };
}

function makeSelectCell(
  value: unknown,
  options: SelectCellOption[],
  readonly = false,
): DropdownCellType {
  const stringValue = value == null ? "" : String(value);
  const display = getSelectDisplay(value, options);

  return {
    allowOverlay: !readonly,
    copyData: display,
    data: {
      allowedValues: [
        { label: "None", value: "" },
        ...options.map((option) => ({ label: option.name, value: String(option.id) })),
      ],
      kind: "dropdown-cell",
      value: stringValue,
    },
    kind: GridCellKind.Custom,
    readonly,
  };
}

function isDropdownCell(cell: CustomCell): cell is DropdownCellType {
  return "kind" in cell.data && cell.data.kind === "dropdown-cell";
}

function DropdownEditor({
  initialValue,
  onFinishedEditing,
  value: cell,
}: {
  initialValue?: string;
  onFinishedEditing: (newValue?: DropdownCellType) => void;
  value: DropdownCellType;
}) {
  const { allowedValues, value: valueIn } = cell.data;
  const [value, setValue] = React.useState(valueIn);
  const [inputValue, setInputValue] = React.useState(initialValue ?? "");
  const theme = useTheme();

  const values = React.useMemo(
    () =>
      allowedValues.map((option) => {
        if (typeof option === "string" || option == null) {
          return {
            label: option?.toString() ?? "",
            value: option ?? "",
          };
        }
        return option;
      }),
    [allowedValues],
  );

  if (cell.readonly) {
    return (
      <div className="gdg-r6sia3g">
        <TextCellEntry
          autoFocus={false}
          disabled
          highlight
          value={value ?? ""}
          onChange={() => undefined}
        />
      </div>
    );
  }

  return (
    <div className="gdg-wghi2zc">
      <Select
        autoFocus
        className="glide-select"
        classNamePrefix="glide-select"
        components={{
          DropdownIndicator: () => null,
          IndicatorSeparator: () => null,
        }}
        captureMenuScroll
        inputValue={inputValue}
        menuPlacement="auto"
        menuPortalTarget={document.getElementById("portal") ?? document.body}
        menuPosition="fixed"
        menuShouldScrollIntoView={false}
        maxMenuHeight={220}
        openMenuOnFocus
        options={values}
        onInputChange={setInputValue}
        styles={{
          control: (base) => ({
            ...base,
            border: 0,
            boxShadow: "none",
          }),
          menuPortal: (base) => ({
            ...base,
            zIndex: 9999,
          }),
          option: (base, { isFocused }) => ({
            ...base,
            cursor: isFocused ? "pointer" : undefined,
            fontFamily: theme.fontFamily,
            fontSize: theme.editorFontSize,
            paddingLeft: theme.cellHorizontalPadding,
            paddingRight: theme.cellHorizontalPadding,
            ":active": {
              ...base[":active"],
              color: theme.accentFg,
            },
            ":empty::after": {
              content: '"&nbsp;"',
              visibility: "hidden",
            },
          }),
        }}
        theme={(selectTheme) => ({
          ...selectTheme,
          colors: {
            ...selectTheme.colors,
            neutral0: theme.bgCell,
            neutral5: theme.bgCell,
            neutral10: theme.bgCell,
            neutral20: theme.bgCellMedium,
            neutral30: theme.bgCellMedium,
            neutral40: theme.bgCellMedium,
            neutral50: theme.textLight,
            neutral60: theme.textMedium,
            neutral70: theme.textMedium,
            neutral80: theme.textDark,
            neutral90: theme.textDark,
            neutral100: theme.textDark,
            primary: theme.accentColor,
            primary25: theme.accentLight,
            primary50: theme.accentColor,
            primary75: theme.accentColor,
          },
        })}
        value={values.find((option) => option.value === value)}
        onChange={async (option) => {
          if (option === null) return;
          setValue(option.value);
          await new Promise((resolve) => window.requestAnimationFrame(resolve));
          onFinishedEditing({
            ...cell,
            data: {
              ...cell.data,
              value: option.value,
            },
          });
        }}
      />
    </div>
  );
}

const FixedDropdownCell: CustomRenderer<DropdownCellType> = {
  ...DropdownCell,
  provideEditor: () => ({
    deletedValue: (cell) => ({
      ...cell,
      copyData: "",
      data: {
        ...cell.data,
        value: "",
      },
    }),
    disablePadding: true,
    editor: DropdownEditor,
  }),
};

function compareValues(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (a instanceof Date || b instanceof Date) {
    return (
      new Date(a as string | number | Date).getTime() -
      new Date(b as string | number | Date).getTime()
    );
  }

  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function sortExpenses(
  expenses: Expense[],
  sort: SortState,
  selectOptions: Record<string, SelectCellOption[]>,
) {
  if (!sort) return expenses;

  return [...expenses].sort((first, second) => {
    const firstValue =
      sort.column === "category" || sort.column === "usedByTarget"
        ? getSelectDisplay(first[sort.column], selectOptions[sort.column] ?? [])
        : first[sort.column];
    const secondValue =
      sort.column === "category" || sort.column === "usedByTarget"
        ? getSelectDisplay(second[sort.column], selectOptions[sort.column] ?? [])
        : second[sort.column];

    const result = compareValues(firstValue, secondValue);
    return sort.direction === "asc" ? result : -result;
  });
}

function getSearchText(expense: Expense, selectOptions: Record<string, SelectCellOption[]>) {
  return [
    expense.origin,
    expense.title,
    expense.currency,
    expense.amount,
    expense.installments,
    formatDateValue(expense.date),
    toDateTextValue(expense.date),
    getSelectDisplay(expense.category, selectOptions.category ?? []),
    getSelectDisplay(expense.usedByTarget, selectOptions.usedByTarget ?? []),
  ]
    .filter((value) => value != null && value !== "")
    .join(" ")
    .toLowerCase();
}

function filterExpenses(
  expenses: Expense[],
  searchValue: string,
  selectOptions: Record<string, SelectCellOption[]>,
) {
  const query = searchValue.trim().toLowerCase();
  if (!query) return expenses;

  return expenses.filter((expense) => getSearchText(expense, selectOptions).includes(query));
}

function formatTitle(columnId: SortableColumnId, sort: SortState) {
  const label = COLUMN_LABELS[columnId];
  if (!sort || sort.column !== columnId) return label;
  return `${label} ${sort.direction === "asc" ? "↑" : "↓"}`;
}

function computeColumns(containerWidth: number, sort: SortState): GridColumn[] {
  const width = Math.max(containerWidth - 34, 192);
  const fixedColumnWidth = COLUMN_IDS.filter((id) => id !== "title").reduce(
    (total, id) => total + BASE_COLUMN_WIDTHS[id],
    0,
  );
  const titleWidth = Math.max(80, width - fixedColumnWidth);
  const naturalWidth = fixedColumnWidth + titleWidth;
  const scale = naturalWidth > width ? width / naturalWidth : 1;
  const scaledWidths = COLUMN_IDS.map((id) =>
    Math.max(24, Math.floor((id === "title" ? titleWidth : BASE_COLUMN_WIDTHS[id]) * scale)),
  );
  const scaledTotal = scaledWidths.reduce((total, columnWidth) => total + columnWidth, 0);
  const adjustment = Math.floor(width) - scaledTotal;
  const titleIndex = COLUMN_IDS.indexOf("title");
  scaledWidths[titleIndex] = Math.max(24, (scaledWidths[titleIndex] ?? 0) + adjustment);

  return COLUMN_IDS.map((id, index) => ({
    id,
    title: formatTitle(id, sort),
    width: scaledWidths[index],
  }));
}

function getGridHeight(rowCount: number) {
  const rows = Math.max(rowCount, 2);
  return 36 + rows * 34 + 2;
}

function getSelectedRowIndexesForColumn(
  selection: GridSelection,
  columnIndex: number,
  rowCount: number,
  rowIndex: number,
) {
  const range = selection.current?.range;
  if (!range) return [rowIndex];
  if (range.width !== 1 || range.height < 1 || range.x !== columnIndex) {
    return [rowIndex];
  }
  if (rowIndex < range.y || rowIndex >= range.y + range.height) {
    return [rowIndex];
  }

  return Array.from({ length: range.height }, (_, offset) => range.y + offset).filter(
    (nextRowIndex) => nextRowIndex >= 0 && nextRowIndex < rowCount,
  );
}

function useElementWidth() {
  const [element, setElement] = React.useState<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry?.contentRect.width ?? 0);
    });
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, [element]);

  return [setElement, width] as const;
}

export function DataTable({ data, onAddExpense, selectOptions, onUpdateData }: DataTableProps) {
  const tableId = React.useId();
  const gridRef = React.useRef<DataEditorRef>(null);
  const deleteExpenses = useDeleteExpenses();
  const [containerRef, containerWidth] = useElementWidth();
  const [sort, setSort] = React.useState<SortState>(null);
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [selection, setSelection] = React.useState<GridSelection>(EMPTY_SELECTION);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (activeSearchTableId !== tableId) return;

      if ((event.ctrlKey || event.metaKey) && event.code === "KeyF") {
        setShowSearch((current) => !current);
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [tableId]);

  const filteredData = React.useMemo(
    () => filterExpenses(data, searchValue, selectOptions),
    [data, searchValue, selectOptions],
  );
  const sortedData = React.useMemo(
    () => sortExpenses(filteredData, sort, selectOptions),
    [filteredData, selectOptions, sort],
  );
  const gridColumns = React.useMemo(
    () => computeColumns(containerWidth, sort),
    [containerWidth, sort],
  );
  const hasRows = sortedData.length > 0;
  const rowCount = sortedData.length;
  const selectedExpenseIds = React.useMemo(
    () =>
      selection.rows
        .toArray()
        .filter((rowIndex) => rowIndex >= 0 && rowIndex < sortedData.length)
        .map((rowIndex) => sortedData[rowIndex]?.id)
        .filter((id): id is number => id != null),
    [selection.rows, sortedData],
  );

  const onGridSelectionChange = React.useCallback((nextSelection: GridSelection) => {
    setSelection(nextSelection);
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelection(EMPTY_SELECTION);
  }, []);

  const deleteSelectedExpenses = React.useCallback(async () => {
    if (selectedExpenseIds.length === 0) return;

    clearSelection();
    await deleteExpenses.mutateAsync(selectedExpenseIds);
  }, [clearSelection, deleteExpenses, selectedExpenseIds]);
  const totalsByCurrency = React.useMemo(
    () =>
      sortedData.reduce<Record<string, number>>((totals, expense) => {
        const currency = expense.currency ?? "ARS";
        totals[currency] = (totals[currency] ?? 0) + Number(expense.amount ?? 0);
        return totals;
      }, {}),
    [sortedData],
  );
  const totalText = React.useMemo(
    () =>
      Object.entries(totalsByCurrency)
        .map(([currency, total]) => formatCurrency(total, currency))
        .join(" · "),
    [totalsByCurrency],
  );

  const getCellContent = React.useCallback(
    ([columnIndex, rowIndex]: Item): GridCell => {
      if (!hasRows) {
        return makeTextCell("", undefined, "left", true);
      }

      const columnId = COLUMN_IDS[columnIndex];
      if (!columnId) return makeTextCell("", undefined, "left", true);

      const expense = sortedData[rowIndex];
      if (!expense) return makeTextCell("", undefined, "left", true);

      switch (columnId) {
        case "amount": {
          const parsed = parseAmountInput(expense.amount);
          const amountText = String(parsed.amount);
          return {
            allowNegative: true,
            allowOverlay: true,
            contentAlign: "right",
            copyData: amountText,
            data: parsed.amount,
            displayData: amountText,
            kind: GridCellKind.Number,
            thousandSeparator: false,
          };
        }
        case "category":
        case "usedByTarget":
          return makeSelectCell(expense[columnId], selectOptions[columnId] ?? []);
        case "date":
          return makeTextCell(toDateTextValue(expense.date), formatDateValue(expense.date));
        case "installments":
          return makeTextCell(String(expense.installments ?? ""), undefined, "right");
        case "origin":
        case "title":
          return makeTextCell(String(expense[columnId] ?? ""));
      }
    },
    [hasRows, selectOptions, sortedData],
  );

  const onHeaderClicked = React.useCallback((columnIndex: number) => {
    const columnId = COLUMN_IDS[columnIndex];
    if (!columnId || !isSortableColumn(columnId)) return;

    setSort((current) => {
      if (current?.column !== columnId) return { column: columnId, direction: "asc" };
      if (current.direction === "asc") return { column: columnId, direction: "desc" };
      return null;
    });
  }, []);

  const onCellEdited = React.useCallback(
    ([columnIndex, rowIndex]: Item, newValue: EditableGridCell) => {
      const columnId = COLUMN_IDS[columnIndex];
      if (!columnId) return;

      const targetRowIndexes = getSelectedRowIndexesForColumn(
        selection,
        columnIndex,
        sortedData.length,
        rowIndex,
      );

      for (const targetRowIndex of targetRowIndexes) {
        const expense = sortedData[targetRowIndex];
        if (!expense) continue;

        if (newValue.kind === GridCellKind.Custom && isDropdownCell(newValue)) {
          onUpdateData(expense.id, columnId, newValue.data.value || null);
          continue;
        }

        if ("data" in newValue) {
          onUpdateData(expense.id, columnId, newValue.data);
        }
      }
    },
    [onUpdateData, selection, sortedData],
  );

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-md border bg-background"
      onFocusCapture={() => {
        activeSearchTableId = tableId;
      }}
      onPointerDownCapture={() => {
        activeSearchTableId = tableId;
      }}
    >
      <div className="relative">
        <DataEditor
          ref={gridRef}
          cellActivationBehavior="double-click"
          className="expenses-grid"
          columns={gridColumns}
          customRenderers={[FixedDropdownCell]}
          fillHandle={false}
          getCellContent={getCellContent}
          getCellsForSelection
          gridSelection={selection}
          headerHeight={36}
          height={getGridHeight(rowCount)}
          keybindings={{ search: false }}
          minColumnWidth={24}
          onCellEdited={onCellEdited}
          onGridSelectionChange={onGridSelectionChange}
          onHeaderClicked={onHeaderClicked}
          onSearchClose={() => {
            setShowSearch(false);
            setSearchValue("");
          }}
          onSearchValueChange={setSearchValue}
          rangeSelect="rect"
          rowHeight={34}
          rowMarkers={{
            checkboxStyle: "square",
            kind: "both",
          }}
          rows={rowCount}
          searchResults={[]}
          searchValue={searchValue}
          showSearch={showSearch}
          smoothScrollX
          smoothScrollY
          theme={GRID_THEME}
          verticalBorder
          width="100%"
        />
      </div>

      {hasRows && (
        <div className="relative flex min-h-11 items-center border-t bg-muted/35 px-3 py-2 text-xs">
          {selectedExpenseIds.length > 0 ? (
            <div className="flex h-7 items-center gap-1.5 pl-2">
              <span className="text-[11px] leading-none text-foreground/85">
                {selectedExpenseIds.length} selected
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                className="size-6"
                aria-label="Clear selection"
                onClick={clearSelection}
              >
                <X className="size-3.5" />
              </Button>
              <Button
                size="xs"
                variant="destructive"
                className="h-6 px-2 text-[11px]"
                disabled={deleteExpenses.isPending}
                onClick={() => void deleteSelectedExpenses()}
              >
                {deleteExpenses.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          ) : (
            <div className="flex h-7 items-center gap-1.5">
              <Button
                size="xs"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => void onAddExpense()}
              >
                <Plus className="size-3.5" />
                Add expense
              </Button>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center gap-3">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium text-foreground">{totalText}</span>
          </div>
        </div>
      )}
    </div>
  );
}
