import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

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

  if (error) return "An error has ocurred: " + error.message;

  return (
    <div className="container mx-auto p-5">
      <DataTable
        columns={columns}
        data={data?.expenses ?? []}
        selectOptions={{
          category: categoriesQuery.data?.categories ?? [],
          usedBy: usersQuery.data?.users ?? [],
          paidBy: usersQuery.data?.users ?? [],
        }}
        onUpdateData={(expenseId, columnId, value) => {
          updateExpense.mutate({
            id: expenseId,
            patch: {
              [columnId]:
                columnId === "amount"
                  ? Number(value)
                  : columnId === "category" || columnId === "usedBy" || columnId === "paidBy"
                    ? value == null
                      ? null
                      : Number(value)
                    : value,
            },
          });
        }}
      />
    </div>
  );
}
