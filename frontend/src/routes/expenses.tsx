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

async function getAllUsers() {
  const res = await api.users.$get();
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
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploadStatus, setUploadStatus] = React.useState<string | null>(null);
  const [ownerId, setOwnerId] = React.useState<number | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["get-all-categories"],
    queryFn: getAllCategroies,
    staleTime: 1000 * 60,
  });

  const usersQuery = useQuery({
    queryKey: ["get-all-users"],
    queryFn: getAllUsers,
    staleTime: 1000 * 60,
  });

  const { error, data } = useQuery({
    queryKey: ["get-all-expenses"],
    queryFn: getAllExpenses,
    staleTime: 1000 * 60,
  });

  const updateExpense = useUpdateExpense();

  React.useEffect(() => {
    if (ownerId != null) return;
    const firstUser = usersQuery.data?.users[0];
    if (firstUser) {
      setOwnerId(firstUser.id);
    }
  }, [ownerId, usersQuery.data?.users]);

  function hasDraggedFiles(event: React.DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).some((type) => type.toLowerCase() === "files");
  }

  async function uploadFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    );
    if (pdfs.length === 0) {
      setUploadStatus("Drop a PDF statement.");
      return;
    }
    if (ownerId == null) {
      setUploadStatus("Select an owner before uploading.");
      return;
    }

    const body = new FormData();
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

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void uploadFiles(event.dataTransfer.files);
  }

  if (error) return "An error has ocurred: " + error.message;

  return (
    <div className="container mx-auto space-y-4 p-5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium" htmlFor="statement-owner">
          Statement owner
        </label>
        <select
          id="statement-owner"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={ownerId ?? ""}
          onChange={(event) => setOwnerId(Number(event.target.value))}
        >
          <option value="" disabled>
            Select owner
          </option>
          {(usersQuery.data?.users ?? []).map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      {uploadStatus && <p className="text-sm text-muted-foreground">{uploadStatus}</p>}

      <div
        className="relative"
        onDragEnter={(event) => {
          event.preventDefault();
          if (!hasDraggedFiles(event)) return;
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!hasDraggedFiles(event)) return;
          setIsDragging(true);
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onDrop}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-md border-4 border-dashed border-gray-400 bg-background/80 text-lg font-medium text-gray-600">
            Drop files here
          </div>
        )}

        <DataTable
          columns={columns}
          data={(data?.expenses ?? []).map((expense) => ({
            ...expense,
            date: expense.date ? new Date(expense.date) : null,
          }))}
          selectOptions={{
            category: categoriesQuery.data?.categories ?? [],
            usedBy: usersQuery.data?.users ?? [],
          }}
          onUpdateData={(expenseId, columnId, value) => {
            updateExpense.mutate({
              id: expenseId,
              patch: {
                [columnId]:
                  columnId === "amount"
                    ? Number(value)
                    : columnId === "category" || columnId === "usedBy"
                      ? value == null
                        ? null
                        : Number(value)
                      : value,
              },
            });
          }}
        />
      </div>
    </div>
  );
}
