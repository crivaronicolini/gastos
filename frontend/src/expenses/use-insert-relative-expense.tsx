import type { Expense } from "@server/db/schema";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

type InsertRelativeExpenseInput = {
  anchorExpenseId: number;
  groupId: number;
  ownerId: number;
  position: "above" | "below";
};

function normalizeExpense(expense: Expense) {
  return {
    ...expense,
    date: expense.date ? new Date(expense.date) : null,
  };
}

export function useInsertRelativeExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InsertRelativeExpenseInput) => {
      const res = await api.expenses["insert-relative"].$post({
        json: input,
      });
      if (!res.ok) {
        throw new Error("failed to insert expense");
      }
      return res.json();
    },

    onSuccess: ({ expense }, variables) => {
      if (!expense) return;

      const normalizedExpense = normalizeExpense(expense as Expense);

      queryClient.setQueryData<{ expenses: Expense[] }>(["get-all-expenses"], (current) => {
        if (!current) return current;

        const anchorIndex = current.expenses.findIndex(
          (existingExpense) => existingExpense.id === variables.anchorExpenseId,
        );
        if (anchorIndex === -1) {
          return { expenses: [...current.expenses, normalizedExpense] };
        }

        const nextExpenses = [...current.expenses];
        const insertIndex = variables.position === "above" ? anchorIndex : anchorIndex + 1;
        nextExpenses.splice(insertIndex, 0, normalizedExpense);

        return { expenses: nextExpenses };
      });
    },
  });
}
