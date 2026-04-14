import { type Expense, type ExpenseUpdate } from "@server/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

type UpdateExpenseInput = {
  id: number;
  patch: ExpenseUpdate;
};

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: UpdateExpenseInput) => {
      const res = await api.expenses[":id{[0-9]+}"].$patch({
        param: { id: String(id) },
        json: patch,
      });
      if (!res.ok) {
        throw new Error("failed to update expense");
      }
      return res.json();
    },

    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ["get-all-expenses"] });
      const previous = queryClient.getQueryData<{ expenses: Expense[] }>(["get-all-expenses"]);

      queryClient.setQueryData<{ expenses: Expense[] }>(["get-all-expenses"], (old) => {
        if (!old) return old;
        return {
          expenses: old.expenses.map((expense) =>
            expense.id === id ? { ...expense, ...patch } : expense,
          ),
        };
      });

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["get-all-expenses"], context.previous);
      }
    },
  });
}
