import type { Expense } from "@server/db/schema";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import * as React from "react";

import { DataTable } from "@/expenses/data-table";
import { EditableGroupTitle } from "@/expenses/editable-group-title";
import { ExpensePeriodChart } from "@/expenses/expense-period-chart";
import { parseAmountInput } from "@/expenses/parse-amount-input";
import { UploadStatusBadge } from "@/expenses/upload-status-badge";
import {
  activeWorkflowStatuses,
  type TrackedUpload,
  type WorkflowStatusResponse,
} from "@/expenses/upload-tracking";
import { useUpdateExpense } from "@/expenses/use-update-expense";
import { api } from "@/lib/api";
import authClient from "@/lib/auth-client";

type ExpensesSearch = {
  period?: string;
};

export const Route = createFileRoute("/expenses")({
  beforeLoad: async () => {
    const session = await authClient.getSession();

    if (!session.data?.session) {
      throw redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>): ExpensesSearch => ({
    period:
      typeof search.period === "string" && /^\d{4}-\d{2}$/.test(search.period)
        ? search.period
        : undefined,
  }),
  component: Expenses,
});

const UPLOAD_STORAGE_KEY = "gastos:workflow-uploads";
const SUCCESS_BADGE_TTL = 8_000;
const TREMOR_COLORS = ["blue", "cyan", "indigo", "violet", "amber", "emerald", "rose"];
const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;

type UploadResponse = {
  uploads: Array<Omit<TrackedUpload, "status">>;
};

type UploadMutationContext = {
  optimisticUploads: TrackedUpload[];
};

type ExpenseWithStatementPeriod = Expense & {
  statementGroupId: number | null;
  statementMonth: string | null;
  statementOwnerId: number | null;
};

type ChartPeriodTotals = {
  total: number;
  [ownerName: string]: number;
};

async function getAllCategroies() {
  const res = await api.categories.$get();
  if (!res.ok) {
    throw new Error("server error");
  }
  const data = await res.json();
  return data;
}

async function getAllGroups() {
  const res = await api.groups.$get();
  if (!res.ok) {
    throw new Error("server error");
  }
  const data = await res.json();
  return data;
}

async function getAllExpenses() {
  const res = await api.expenses.$get();
  if (!res.ok) {
    throw new Error("server error");
  }
  const data = (await res.json()) as { expenses: ExpenseWithStatementPeriod[] };
  return data;
}

function formatPeriodLabel(period: string, month: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("en-US", {
    month,
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${period}-01T00:00:00Z`));
}

async function readErrorMessage(res: Response) {
  const fallback = `Upload failed with HTTP ${res.status}`;

  try {
    const payload = (await res.json()) as { error?: unknown; message?: unknown };
    if (typeof payload.message === "string") return payload.message;
    if (typeof payload.error === "string") return payload.error;
  } catch {
    // Keep the status-based fallback when the response is not JSON.
  }

  return fallback;
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function removeOptimisticUploads(
  uploads: TrackedUpload[],
  optimisticUploads: TrackedUpload[] | undefined,
) {
  if (!optimisticUploads?.length) return uploads;

  const optimisticIds = new Set(optimisticUploads.map((upload) => upload.workflowId));
  return uploads.filter((upload) => !optimisticIds.has(upload.workflowId));
}

function getCurrentPeriod() {
  return new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date());
}

function buildRollingPeriods(currentPeriod: string, monthsAfterCurrent = 1, totalMonths = 12) {
  const [year, month] = currentPeriod.split("-").map(Number);
  const currentIndex = totalMonths - monthsAfterCurrent - 1;
  const start = new Date(Date.UTC(year, month - 1 - currentIndex, 1));

  return Array.from({ length: totalMonths }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const nextYear = date.getUTCFullYear();
    const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${nextYear}-${nextMonth}`;
  });
}

function getGroupDisplayName(
  group: {
    members?: Array<{ user: { name: string } }>;
    name?: string | null;
  } | null,
) {
  if (!group) return "Expenses";

  const fallbackName = (group.members ?? []).map((member) => member.user.name).join(" & ");
  return group.name?.trim() || fallbackName || "Expenses";
}

function readStoredUploads() {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(UPLOAD_STORAGE_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((upload): upload is TrackedUpload => {
      return (
        typeof upload?.workflowId === "string" &&
        typeof upload.fileName === "string" &&
        typeof upload.fileKey === "string" &&
        typeof upload.groupId === "number" &&
        typeof upload.ownerId === "number" &&
        typeof upload.status === "string"
      );
    });
  } catch {
    return [];
  }
}

function isOptimisticWorkflowId(workflowId: string) {
  return workflowId.startsWith("optimistic:");
}

async function getWorkflowStatuses(ids: string[]) {
  const params = new URLSearchParams({ ids: ids.join(",") });
  const res = await fetch(`/api/upload/status?${params.toString()}`);
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as WorkflowStatusResponse;
}

async function retryWorkflow(id: string) {
  const res = await fetch(`/api/upload/${id}/retry`, { method: "POST" });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as WorkflowStatusResponse["statuses"][number];
}

export function Expenses() {
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const [draggingOwnerId, setDraggingOwnerId] = React.useState<number | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["get-all-categories"],
    queryFn: getAllCategroies,
    staleTime: 1000 * 60,
  });

  const groupsQuery = useQuery({
    queryKey: ["get-all-groups"],
    queryFn: getAllGroups,
    staleTime: 1000 * 60,
  });

  const trackedUploadsQuery = useQuery({
    queryKey: ["tracked-uploads"],
    queryFn: readStoredUploads,
    initialData: readStoredUploads,
    staleTime: Infinity,
  });

  const trackedUploads = trackedUploadsQuery.data;
  const groups = groupsQuery.data?.groups ?? [];
  const currentGroup = groups[0] ?? null;
  const statementOwners = React.useMemo(
    () => currentGroup?.members.map((member) => member.user) ?? [],
    [currentGroup?.members],
  );
  const usageTargets = currentGroup?.usageTargets ?? [];

  const trackedWorkflowIds = trackedUploads
    .map((upload) => upload.workflowId)
    .filter((workflowId) => !isOptimisticWorkflowId(workflowId));

  const workflowStatusesQuery = useQuery({
    queryKey: ["upload-workflow-statuses", trackedWorkflowIds.join(",")],
    queryFn: () => getWorkflowStatuses(trackedWorkflowIds),
    enabled: trackedWorkflowIds.length > 0,
    refetchInterval: (query) => {
      const data = query.state.data as WorkflowStatusResponse | undefined;
      if (!data) return 10_000;

      return data.statuses.some((status) => activeWorkflowStatuses.has(status.status))
        ? 10_000
        : false;
    },
  });

  const uploads = React.useMemo(() => {
    const statusesById = new Map(
      (workflowStatusesQuery.data?.statuses ?? []).map((status) => [status.id, status]),
    );

    return trackedUploads.map((upload) => {
      const nextStatus = statusesById.get(upload.workflowId);
      if (!nextStatus) return upload;

      return {
        ...upload,
        completedAt:
          nextStatus.status === "complete"
            ? (upload.completedAt ?? workflowStatusesQuery.dataUpdatedAt)
            : undefined,
        error: nextStatus.error ?? null,
        status: nextStatus.status,
      };
    });
  }, [trackedUploads, workflowStatusesQuery.data, workflowStatusesQuery.dataUpdatedAt]);

  const hasActiveUploads = uploads.some((upload) => activeWorkflowStatuses.has(upload.status));

  const { error, data } = useQuery({
    queryKey: ["get-all-expenses"],
    queryFn: getAllExpenses,
    staleTime: 1000 * 60,
    refetchInterval: hasActiveUploads ? 10_000 : false,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ files, ownerId }: { files: FileList | File[]; ownerId: number }) => {
      if (!currentGroup) {
        throw new Error("Missing group");
      }

      const pdfs = Array.from(files).filter(isPdfFile);

      if (pdfs.length === 0) {
        throw new Error("Drop at least one PDF file.");
      }

      const oversized = pdfs.find((file) => file.size > MAX_UPLOAD_BYTES);
      if (oversized) {
        throw new Error(
          `${oversized.name} is too large. Upload PDFs smaller than 95 MB through this page.`,
        );
      }

      const body = new FormData();
      body.append("group_id", String(currentGroup.id));
      body.append("owner_id", String(ownerId));
      body.append("statement_month", selectedPeriod);
      for (const file of pdfs) {
        body.append("file", file);
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body,
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }

      return (await res.json()) as UploadResponse;
    },
    onMutate: ({ files, ownerId }) => {
      if (!currentGroup) return { optimisticUploads: [] };

      const optimisticUploads = Array.from(files).filter(isPdfFile).map((file) => ({
        completedAt: undefined,
        error: null,
        fileKey: `optimistic:${file.name}`,
        fileName: file.name,
        groupId: currentGroup.id,
        ownerId,
        status: "queued" as const,
        workflowId: `optimistic:${crypto.randomUUID()}`,
      }));

      queryClient.setQueryData<TrackedUpload[]>(["tracked-uploads"], (current = []) => [
        ...current,
        ...optimisticUploads,
      ]);

      return {
        optimisticUploads,
      };
    },
    onSuccess: (payload, _variables, context: UploadMutationContext | undefined) => {
      queryClient.setQueryData<TrackedUpload[]>(["tracked-uploads"], (current = []) => [
        ...removeOptimisticUploads(current, context?.optimisticUploads),
        ...payload.uploads.map((upload) => ({
          ...upload,
          status: "queued" as const,
        })),
      ]);
    },
    onError: (error, _variables, context: UploadMutationContext | undefined) => {
      const message = error instanceof Error ? error.message : String(error);
      queryClient.setQueryData<TrackedUpload[]>(["tracked-uploads"], (current = []) => [
        ...removeOptimisticUploads(current, context?.optimisticUploads),
        ...(context?.optimisticUploads.map((upload) => ({
          ...upload,
          error: { message, name: "UploadError" },
          status: "errored" as const,
        })) ?? []),
      ]);
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (uploadsToRetry: TrackedUpload[]) =>
      Promise.all(
        uploadsToRetry.map(async (upload) => {
          try {
            return {
              ok: true as const,
              status: await retryWorkflow(upload.workflowId),
              upload,
            };
          } catch (error) {
            return {
              error,
              ok: false as const,
              upload,
            };
          }
        }),
      ),
    onMutate: async (uploadsToRetry) => {
      queryClient.setQueryData<TrackedUpload[]>(["tracked-uploads"], (current = []) =>
        current.map((upload) =>
          uploadsToRetry.some((retryUpload) => retryUpload.workflowId === upload.workflowId)
            ? { ...upload, completedAt: undefined, error: null, status: "queued" }
            : upload,
        ),
      );
    },
    onSuccess: (results) => {
      queryClient.setQueryData<TrackedUpload[]>(["tracked-uploads"], (current = []) =>
        current.map((upload) => {
          const result = results.find((item) => item.upload.workflowId === upload.workflowId);
          if (!result) return upload;

          if (result.ok) {
            return {
              ...upload,
              error: result.status.error ?? null,
              status: result.status.status,
            };
          }

          return {
            ...upload,
            error: {
              message: result.error instanceof Error ? result.error.message : String(result.error),
              name: "WorkflowRetryError",
            },
            status: "errored",
          };
        }),
      );
    },
  });

  const updateExpense = useUpdateExpense();

  const addExpenseMutation = useMutation({
    mutationFn: async ({ ownerId }: { ownerId: number }) => {
      if (!currentGroup) {
        throw new Error("Missing group");
      }

      const res = await api.expenses.$post({
        json: {
          groupId: currentGroup.id,
          month: selectedPeriod,
          ownerId,
          title: "",
          amount: 0,
          currency: "ARS",
          date: new Date().toISOString().split("T")[0],
          origin: "extras",
          statement: null,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to create expense");
      }

      const data = await res.json();
      return data;
    },
    onSuccess: ({ expense }) => {
      queryClient.setQueryData<{ expenses: ExpenseWithStatementPeriod[] }>(
        ["get-all-expenses"],
        (current) => {
          if (!current) return { expenses: [expense as ExpenseWithStatementPeriod] };
          return {
            expenses: [...current.expenses, expense as ExpenseWithStatementPeriod],
          };
        },
      );
    },
  });

  async function addExpense(ownerId: number) {
    if (!currentGroup) return;
    await addExpenseMutation.mutateAsync({ ownerId });
  }

  const currentPeriod = React.useMemo(() => getCurrentPeriod(), []);
  const expenses = React.useMemo(
    () =>
      (data?.expenses ?? []).map((expense) => ({
        ...expense,
        date: expense.date ? new Date(expense.date) : null,
      })),
    [data?.expenses],
  );
  const groupExpenses = React.useMemo(
    () => expenses.filter((expense) => expense.statementGroupId === currentGroup?.id),
    [currentGroup?.id, expenses],
  );
  const selectedPeriod = search.period ?? currentPeriod;
  const calendarPeriods = React.useMemo(() => buildRollingPeriods(currentPeriod), [currentPeriod]);
  const filteredExpenses = React.useMemo(
    () => groupExpenses.filter((expense) => expense.statementMonth === selectedPeriod),
    [groupExpenses, selectedPeriod],
  );
  const chartCategories = React.useMemo(() => {
    const ownerNames = statementOwners.map((user) => user.name);
    const ownerIds = new Set(statementOwners.map((user) => user.id));
    const hasUnassigned = groupExpenses.some(
      (expense) => expense.statementOwnerId == null || !ownerIds.has(expense.statementOwnerId),
    );

    return hasUnassigned
      ? [...ownerNames, "Unassigned"]
      : ownerNames;
  }, [groupExpenses, statementOwners]);
  const chartData = React.useMemo(() => {
    const totalsByPeriod = new Map<string, ChartPeriodTotals>();
    const ownerNamesById = new Map(statementOwners.map((user) => [user.id, user.name]));

    for (const expense of groupExpenses) {
      if (!expense.statementMonth || expense.amount == null) continue;

      const amount = Number(expense.amount);
      const ownerName =
        expense.statementOwnerId == null
          ? "Unassigned"
          : ownerNamesById.get(expense.statementOwnerId) ?? "Unassigned";
      const periodTotals = totalsByPeriod.get(expense.statementMonth) ?? { total: 0 };

      periodTotals.total += amount;
      periodTotals[ownerName] = (periodTotals[ownerName] ?? 0) + amount;
      totalsByPeriod.set(expense.statementMonth, periodTotals);
    }

    return calendarPeriods.map((period) => ({
      ...Object.fromEntries(chartCategories.map((category) => [category, 0])),
      ...(totalsByPeriod.get(period) ?? {}),
      hasData: (totalsByPeriod.get(period)?.total ?? 0) > 0,
      label: formatPeriodLabel(period),
      period,
      total: totalsByPeriod.get(period)?.total ?? 0,
    }));
  }, [calendarPeriods, chartCategories, groupExpenses, statementOwners]);
  const chartColors = React.useMemo(
    () => chartCategories.map((_, index) => TREMOR_COLORS[index % TREMOR_COLORS.length]),
    [chartCategories],
  );
  const chartCurrency = React.useMemo(() => {
    const currencies = new Set(
      groupExpenses
        .map((expense) => expense.currency)
        .filter((currency): currency is string => currency != null),
    );

    return currencies.size === 1 ? Array.from(currencies)[0] : null;
  }, [groupExpenses]);
  const memberTables = statementOwners.map((user) => ({
    user,
    expenses: filteredExpenses.filter((expense) => expense.statementOwnerId === user.id),
  }));

  React.useEffect(() => {
    if (search.period === selectedPeriod) return;

    void navigate({
      replace: true,
      search: (prev) => ({ ...prev, period: selectedPeriod }),
    });
  }, [navigate, search.period, selectedPeriod]);

  React.useEffect(() => {
    window.localStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(trackedUploads));
  }, [trackedUploads]);

  React.useEffect(() => {
    if (!uploads.some((upload) => upload.status === "complete")) return;

    const timeout = window.setTimeout(() => {
      queryClient.setQueryData<TrackedUpload[]>(["tracked-uploads"], (current = []) =>
        current.filter((upload) => {
          const nextUpload = uploads.find((item) => item.workflowId === upload.workflowId);
          if (!nextUpload) return false;

          return (
            nextUpload.status !== "complete" ||
            nextUpload.completedAt == null ||
            Date.now() - nextUpload.completedAt < SUCCESS_BADGE_TTL
          );
        }),
      );
    }, SUCCESS_BADGE_TTL);

    return () => window.clearTimeout(timeout);
  }, [queryClient, uploads]);

  function hasDraggedFiles(event: React.DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).some((type) => type.toLowerCase() === "files");
  }

  function uploadFiles(files: FileList | File[], ownerId: number) {
    if (!currentGroup) return;
    uploadMutation.mutate({ files, ownerId });
  }

  function onDrop(event: React.DragEvent<HTMLElement>, ownerId: number) {
    event.preventDefault();
    setDraggingOwnerId(null);
    uploadFiles(event.dataTransfer.files, ownerId);
  }

  async function retryUploads(uploads: TrackedUpload[]) {
    await retryMutation.mutateAsync(uploads);
  }

  function dismissUploads(uploadsToDismiss: TrackedUpload[]) {
    queryClient.setQueryData<TrackedUpload[]>(["tracked-uploads"], (current = []) =>
      current.filter(
        (upload) =>
          !uploadsToDismiss.some((dismissUpload) => dismissUpload.workflowId === upload.workflowId),
      ),
    );
  }

  function updateExpenseData(expenseId: number, columnId: string, value: unknown) {
    if (columnId === "amount") {
      const { amount, currency } = parseAmountInput(value);

      updateExpense.mutate({
        id: expenseId,
        patch: {
          amount,
          ...(currency ? { currency } : {}),
        },
      });
      return;
    }

    updateExpense.mutate({
      id: expenseId,
      patch: {
        [columnId]:
          columnId === "category" || columnId === "usedByTarget"
            ? value == null
              ? null
              : Number(value)
            : value,
      },
    });
  }

  if (error) return "An error has ocurred: " + error.message;

  const groupTitle = getGroupDisplayName(currentGroup);

  return (
    <div className="mx-auto w-full max-w-screen-3xl space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EditableGroupTitle
          groupId={currentGroup?.id ?? null}
          periodLabel={selectedPeriod ? formatPeriodLabel(selectedPeriod) : null}
          title={groupTitle}
        />
      </div>

      <ExpensePeriodChart
        categories={chartCategories}
        colors={chartColors}
        currency={chartCurrency}
        data={chartData}
        selectedPeriod={selectedPeriod}
        onPeriodSelect={(period) =>
          void navigate({
            search: (prev) => ({ ...prev, period }),
          })
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {memberTables.map(({ expenses: userExpenses, user }) => (
          <section
            key={user.id}
            className="relative space-y-2"
            onDragEnter={(event) => {
              event.preventDefault();
              if (!hasDraggedFiles(event)) return;
              setDraggingOwnerId(user.id);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDraggingOwnerId(null);
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!hasDraggedFiles(event)) return;
              setDraggingOwnerId(user.id);
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => onDrop(event, user.id)}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-medium">{user.name} expenses</h3>
              <UploadStatusBadge
                uploads={uploads.filter(
                  (upload) => upload.groupId === currentGroup?.id && upload.ownerId === user.id,
                )}
                onDismiss={dismissUploads}
                onRetry={(uploads) => void retryUploads(uploads)}
              />
            </div>

            <div className="relative">
              {draggingOwnerId === user.id && (
                <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-md border-4 border-dashed border-gray-400 bg-background/80 text-lg font-medium text-gray-600">
                  Drop files for {user.name}
                </div>
              )}
              <DataTable
                data={userExpenses}
                onAddExpense={() => addExpense(user.id)}
                selectOptions={{
                  category: categoriesQuery.data?.categories ?? [],
                  usedByTarget: usageTargets,
                }}
                onUpdateData={updateExpenseData}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
