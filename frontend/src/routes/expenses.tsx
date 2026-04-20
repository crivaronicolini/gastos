import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

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

function Expenses() {
  const [draggingOwnerId, setDraggingOwnerId] = React.useState<number | null>(null);
  const [groupId, setGroupId] = React.useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = React.useState<string | null>(null);

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

  function hasDraggedFiles(event: React.DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).some((type) => type.toLowerCase() === "files");
  }

  async function uploadFiles(files: FileList | File[], ownerId: number) {
    const pdfs = Array.from(files).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    );
    if (pdfs.length === 0) {
      setUploadStatus("Drop a PDF statement.");
      return;
    }
    if (currentGroup == null) {
      setUploadStatus("Select a group before uploading.");
      return;
    }

    const body = new FormData();
    body.append("group_id", String(currentGroup.id));
    body.append("owner_id", String(ownerId));
    for (const file of pdfs) {
      body.append("file", file);
    }

    setUploadStatus(`Uploading ${pdfs.length} statement${pdfs.length === 1 ? "" : "s"}...`);
    const res = await fetch("/api/upload", {
      method: "POST",
      body,
    });
    if (!res.ok) {
      const message = await res.text();
      setUploadStatus(message || "Upload failed.");
      return;
    }

    setUploadStatus("Upload queued. The statement will appear after processing.");
  }

  function onDrop(event: React.DragEvent<HTMLElement>, ownerId: number) {
    event.preventDefault();
    setDraggingOwnerId(null);
    void uploadFiles(event.dataTransfer.files, ownerId);
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
        <h2 className="text-2xl font-semibold tracking-tight">{currentGroup?.name ?? "Expenses"}</h2>
      </div>

      {uploadStatus && <p className="text-sm text-muted-foreground">{uploadStatus}</p>}

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
            <h3 className="text-lg font-medium">{user.name} expenses</h3>

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
