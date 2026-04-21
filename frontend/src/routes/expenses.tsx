/* eslint-disable react-refresh/only-export-components */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import { columns } from "@/expenses/columns";
import { DataTable } from "@/expenses/data-table";
import { useDeleteExpenses } from "@/expenses/use-delete-expenses";
import { useInsertRelativeExpense } from "@/expenses/use-insert-relative-expense";
import { UploadStatusBadge } from "@/expenses/upload-status-badge";
import {
  activeWorkflowStatuses,
  type TrackedUpload,
  type WorkflowStatusResponse,
} from "@/expenses/upload-tracking";
import { useUpdateExpense } from "@/expenses/use-update-expense";
import { api } from "@/lib/api";

export const Route = createFileRoute("/expenses")({
  component: Expenses,
});

const UPLOAD_STORAGE_KEY = "gastos:workflow-uploads";
const SUCCESS_BADGE_TTL = 8_000;

type UploadResponse = {
  uploads: Array<Omit<TrackedUpload, "status">>;
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
  const data = await res.json();
  return data;
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
  const statementOwners = currentGroup?.members.map((member) => member.user) ?? [];
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
            ? upload.completedAt ?? workflowStatusesQuery.dataUpdatedAt
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

      const pdfs = Array.from(files).filter(
        (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
      );

      const body = new FormData();
      body.append("group_id", String(currentGroup.id));
      body.append("owner_id", String(ownerId));
      for (const file of pdfs) {
        body.append("file", file);
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body,
      });

      return (await res.json()) as UploadResponse;
    },
    onMutate: async ({ files, ownerId }) => {
      if (!currentGroup) return { optimisticWorkflowIds: [] };

      const optimisticUploads = Array.from(files)
        .filter(
          (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
        )
        .map((file) => ({
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
        optimisticWorkflowIds: optimisticUploads.map((upload) => upload.workflowId),
      };
    },
    onSuccess: (payload, _variables, context) => {
      queryClient.setQueryData<TrackedUpload[]>(["tracked-uploads"], (current = []) => [
        ...current.filter(
          (upload) => !context?.optimisticWorkflowIds.includes(upload.workflowId),
        ),
        ...payload.uploads.map((upload) => ({
          ...upload,
          status: "queued" as const,
        })),
      ]);
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData<TrackedUpload[]>(["tracked-uploads"], (current = []) =>
        current.filter((upload) => !context?.optimisticWorkflowIds.includes(upload.workflowId)),
      );
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

  const deleteExpenses = useDeleteExpenses();
  const insertRelativeExpense = useInsertRelativeExpense();
  const updateExpense = useUpdateExpense();
  const expenses = (data?.expenses ?? []).map((expense) => ({
    ...expense,
    date: expense.date ? new Date(expense.date) : null,
  }));
  const memberTables = statementOwners.map((user) => {
    const usageTarget = usageTargets.find((target) => target.user === user.id);
    return {
      user,
      usageTarget,
      expenses: usageTarget
        ? expenses.filter((expense) => expense.usedByTarget === usageTarget.id)
        : [],
    };
  });

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

  async function uploadFiles(files: FileList | File[], ownerId: number) {
    if (!currentGroup) return;
    await uploadMutation.mutateAsync({ files, ownerId });
  }

  function onDrop(event: React.DragEvent<HTMLElement>, ownerId: number) {
    event.preventDefault();
    setDraggingOwnerId(null);
    void uploadFiles(event.dataTransfer.files, ownerId);
  }

  async function retryUploads(uploads: TrackedUpload[]) {
    await retryMutation.mutateAsync(uploads);
  }

  function dismissUploads(uploadsToDismiss: TrackedUpload[]) {
    queryClient.setQueryData<TrackedUpload[]>(["tracked-uploads"], (current = []) =>
      current.filter(
        (upload) =>
          !uploadsToDismiss.some(
            (dismissUpload) => dismissUpload.workflowId === upload.workflowId,
          ),
      ),
    );
  }

  function updateExpenseData(expenseId: number, columnId: string, value: unknown) {
    updateExpense.mutate({
      id: expenseId,
      patch: {
        [columnId]:
          columnId === "amount"
            ? Number(value)
            : columnId === "category" || columnId === "usedByTarget"
              ? value == null
                ? null
                : Number(value)
              : value,
      },
    });
  }

  async function deleteSelectedExpenses(expenseIds: number[]) {
    await deleteExpenses.mutateAsync(expenseIds);
  }

  async function addRelativeExpense(
    anchorExpenseId: number,
    ownerId: number,
    position: "above" | "below",
  ) {
    if (!currentGroup) return;

    await insertRelativeExpense.mutateAsync({
      anchorExpenseId,
      groupId: currentGroup.id,
      ownerId,
      position,
    });
  }

  if (error) return "An error has ocurred: " + error.message;

  return (
    <div className="container mx-auto space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">
          {currentGroup?.name ?? "Expenses"}
        </h2>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {memberTables.map(({ expenses: userExpenses, usageTarget, user }) => (
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
                columns={columns}
                data={userExpenses}
                isDeletingExpenses={deleteExpenses.isPending}
                onInsertRelativeExpense={(anchorExpenseId, position) =>
                  addRelativeExpense(anchorExpenseId, user.id, position)
                }
                onDeleteExpenses={deleteSelectedExpenses}
                selectOptions={{
                  category: categoriesQuery.data?.categories ?? [],
                  usedByTarget: usageTargets,
                }}
                onUpdateData={updateExpenseData}
              />
            </div>

            {!usageTarget && (
              <p className="text-sm text-muted-foreground">
                Missing usage target for this group member.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
