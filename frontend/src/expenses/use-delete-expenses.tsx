import type { Expense } from "@server/db/schema";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export function useDeleteExpenses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await api.expenses["bulk-delete"].$post({
        json: { ids },
      });
      if (!res.ok) {
        throw new Error("failed to delete expenses");
      }
      return res.json();
    },

    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["get-all-expenses"] });
      const previous = queryClient.getQueryData<{ expenses: Expense[] }>(["get-all-expenses"]);

      queryClient.setQueryData<{ expenses: Expense[] }>(["get-all-expenses"], (old) => {
        if (!old) return old;
        return {
          expenses: old.expenses.filter((expense) => !ids.includes(expense.id)),
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
