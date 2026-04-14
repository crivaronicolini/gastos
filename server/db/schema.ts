import { defineRelations } from "drizzle-orm";
import { int, integer, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { z } from "zod";

export const categories = sqliteTable("categories", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
});

export const expenses = sqliteTable("expenses", {
  id: int().primaryKey({ autoIncrement: true }),
  origin: text().notNull(),
  title: text().notNull(),
  amount: numeric({ mode: "number" }),
  date: integer({ mode: "timestamp" }),
  installments: text(),
  category: int().references(() => categories.id),
  usedBy: text(),
  paidBy: text(),
});

export const expenseSelectSchema = createSelectSchema(expenses);
export const expenseInsertSchema = createInsertSchema(expenses, {
  date: z.coerce.date().optional().nullable(),
});
export const expenseUpdateSchema = createUpdateSchema(expenses, {
  date: z.coerce.date().optional().nullable(),
});

export type Expense = z.infer<typeof expenseSelectSchema>;
export type ExpenseInsert = z.infer<typeof expenseInsertSchema>;
export type ExpenseUpdate = z.infer<typeof expenseUpdateSchema>;

export const categorySelectSchema = createSelectSchema(categories);
export const categoryInsertSchema = createInsertSchema(categories);
export const categoryUpdateSchema = createUpdateSchema(categories);

export type Category = z.infer<typeof categorySelectSchema>;
export type CategoryInsert = z.infer<typeof categoryInsertSchema>;
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;

export const relations = defineRelations({ expenses, categories }, (r) => ({
  expenses: {
    categories: r.one.categories({
      from: r.expenses.category,
      to: r.categories.id,
    }),
  },

  categories: {
    expenses: r.many.expenses(),
  },
}));
