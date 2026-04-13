import { int, integer, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { z } from "zod";

export const expenses = sqliteTable("expenses", {
  id: int().primaryKey({ autoIncrement: true }),
  origin: text().notNull(),
  title: text().notNull(),
  amount: numeric({ mode: "number" }),
  date: integer({ mode: "timestamp" }),
  installments: text(),
  category: text(),
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
