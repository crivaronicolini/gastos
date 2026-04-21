import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { columns } from "@/expenses/columns";
import { DataTable } from "@/expenses/data-table";
import { useUpdateExpense } from "@/expenses/use-update-expense";
import { api } from "@/lib/api";

export const Route = createFileRoute("/expenses")({
  component: Expenses,
});

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

// TODO: move the badge stuff to a dedicated file
const UPLOAD_STORAGE_KEY = "gastos:workflow-uploads";
const SUCCESS_BADGE_TTL = 8_000;

type WorkflowStatus =
  | "queued"
  | "running"
  | "paused"
  | "errored"
  | "terminated"
  | "complete"
  | "waiting"
  | "waitingForPause"
  | "unknown";

type WorkflowError = {
  message: string;
  name?: string;
};

type TrackedUpload = {
  completedAt?: number;
  error?: WorkflowError | null;
  fileKey: string;
  fileName: string;
  groupId: number;
  ownerId: number;
  status: WorkflowStatus;
  workflowId: string;
};

type UploadResponse = {
  uploads: Array<Omit<TrackedUpload, "status">>;
};

type WorkflowStatusResponse = {
  statuses: Array<{
    error?: WorkflowError | null;
    id: string;
    status: WorkflowStatus;
  }>;
};

const activeWorkflowStatuses = new Set<WorkflowStatus>([
  "queued",
  "running",
  "paused",
  "waiting",
  "waitingForPause",
]);

const failedWorkflowStatuses = new Set<WorkflowStatus>(["errored", "terminated", "unknown"]);

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

function UploadStatusBadge({
  onRetry,
  uploads,
}: {
  onRetry: (uploads: TrackedUpload[]) => void;
  uploads: TrackedUpload[];
}) {
  const failedUploads = uploads.filter((upload) => failedWorkflowStatuses.has(upload.status));
  if (failedUploads.length > 0) {
    const label = failedUploads.length === 1 ? "Failed" : `${failedUploads.length} failed`;
    const title = failedUploads
      .map((upload) => upload.error?.message ?? `${upload.fileName} failed`)
      .join("\n");

    return (
      <button type="button" title={title} onClick={() => onRetry(failedUploads)}>
        <Badge variant="destructive">{label}. Retry</Badge>
      </button>
    );
  }

  const activeUploads = uploads.filter((upload) => activeWorkflowStatuses.has(upload.status));
  if (activeUploads.length > 0) {
    const label = activeUploads.length === 1 ? "Processing" : `${activeUploads.length} processing`;

    return (
      <Badge variant="secondary">
        <Spinner data-icon="inline-start" className="size-3" />
        {label}
      </Badge>
    );
  }

  const completedUploads = uploads.filter((upload) => upload.status === "complete");
  if (completedUploads.length > 0) {
    const label =
      completedUploads.length === 1 ? "Imported" : `${completedUploads.length} imported`;
    return <Badge variant="outline">{label}</Badge>;
  }

  return null;
}

function Expenses() {
  const [draggingOwnerId, setDraggingOwnerId] = React.useState<number | null>(null);
  const [groupId, setGroupId] = React.useState<number | null>(null);
  const [trackedUploads, setTrackedUploads] = React.useState<TrackedUpload[]>(readStoredUploads);
  const completedWorkflowIds = React.useRef(new Set<string>());
  const queryClient = useQueryClient();

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

  const { error, data } = useQuery({
    queryKey: ["get-all-expenses"],
    queryFn: getAllExpenses,
    staleTime: 1000 * 60,
  });

  const activeWorkflowIds = trackedUploads
    .filter((upload) => activeWorkflowStatuses.has(upload.status))
    .map((upload) => upload.workflowId);

  const workflowStatusesQuery = useQuery({
    queryKey: ["upload-workflow-statuses", activeWorkflowIds.join(",")],
    queryFn: () => getWorkflowStatuses(activeWorkflowIds),
    enabled: activeWorkflowIds.length > 0,
    refetchInterval: 10_000,
  });

  const updateExpense = useUpdateExpense();
  const groups = groupsQuery.data?.groups ?? [];
  const currentGroup = groups.find((group) => group.id === groupId) ?? groups[0];
  const statementOwners = currentGroup?.members.map((member) => member.user) ?? [];
  const usageTargets = currentGroup?.usageTargets ?? [];
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
    if (groupId != null) return;
    const firstGroup = groups[0];
    if (firstGroup) {
      setGroupId(firstGroup.id);
    }
  }, [groupId, groups]);

  React.useEffect(() => {
    window.localStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(trackedUploads));
  }, [trackedUploads]);

  React.useEffect(() => {
    const data = workflowStatusesQuery.data;
    if (!data) return;

    const statusesById = new Map(data.statuses.map((status) => [status.id, status]));
    let shouldRefreshExpenses = false;

    for (const status of data.statuses) {
      if (status.status === "complete" && !completedWorkflowIds.current.has(status.id)) {
        completedWorkflowIds.current.add(status.id);
        shouldRefreshExpenses = true;
      }
      if (status.status !== "complete") {
        completedWorkflowIds.current.delete(status.id);
      }
    }

    setTrackedUploads((uploads) =>
      uploads.map((upload) => {
        const nextStatus = statusesById.get(upload.workflowId);
        if (!nextStatus) return upload;

        return {
          ...upload,
          completedAt:
            nextStatus.status === "complete" ? (upload.completedAt ?? Date.now()) : undefined,
          error: nextStatus.error ?? null,
          status: nextStatus.status,
        };
      }),
    );

    if (shouldRefreshExpenses) {
      void queryClient.invalidateQueries({ queryKey: ["get-all-expenses"] });
    }
  }, [queryClient, workflowStatusesQuery.data]);

  React.useEffect(() => {
    if (!trackedUploads.some((upload) => upload.status === "complete")) return;

    const timeout = window.setTimeout(() => {
      setTrackedUploads((uploads) =>
        uploads.filter(
          (upload) =>
            upload.status !== "complete" ||
            upload.completedAt == null ||
            Date.now() - upload.completedAt < SUCCESS_BADGE_TTL,
        ),
      );
    }, SUCCESS_BADGE_TTL);

    return () => window.clearTimeout(timeout);
  }, [trackedUploads]);

  function hasDraggedFiles(event: React.DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).some((type) => type.toLowerCase() === "files");
  }

  async function uploadFiles(files: FileList | File[], ownerId: number) {
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

    const payload = (await res.json()) as UploadResponse;
    setTrackedUploads((uploads) => [
      ...uploads,
      ...payload.uploads.map((upload) => ({
        ...upload,
        status: "queued" as const,
      })),
    ]);
  }

  function onDrop(event: React.DragEvent<HTMLElement>, ownerId: number) {
    event.preventDefault();
    setDraggingOwnerId(null);
    void uploadFiles(event.dataTransfer.files, ownerId);
  }

  async function retryUploads(uploads: TrackedUpload[]) {
    setTrackedUploads((currentUploads) =>
      currentUploads.map((upload) =>
        uploads.some((retryUpload) => retryUpload.workflowId === upload.workflowId)
          ? { ...upload, completedAt: undefined, error: null, status: "queued" }
          : upload,
      ),
    );

    const results = await Promise.all(
      uploads.map(async (upload) => {
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
    );

    setTrackedUploads((currentUploads) =>
      currentUploads.map((upload) => {
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
                uploads={trackedUploads.filter(
                  (upload) => upload.groupId === currentGroup?.id && upload.ownerId === user.id,
                )}
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
