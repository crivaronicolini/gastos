import { defineRelations } from "drizzle-orm";
import { int, integer, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { z } from "zod";

export const categories = sqliteTable("categories", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
});

export const users = sqliteTable("users", {
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
  usedBy: int().references(() => users.id),
  paidBy: int().references(() => users.id),
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

export const UserSelectSchema = createSelectSchema(users);
export const UserInsertSchema = createInsertSchema(users);
export const UserUpdateSchema = createUpdateSchema(users);

export type User = z.infer<typeof UserSelectSchema>;
export type UserInsert = z.infer<typeof UserInsertSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;

export const relations = defineRelations({ expenses, categories, users }, (r) => ({
  expenses: {
    categoryData: r.one.categories({
      from: r.expenses.category,
      to: r.categories.id,
    }),
    usedByUser: r.one.users({
      from: r.expenses.usedBy,
      to: r.users.id,
      alias: "used",
    }),
    paidByUser: r.one.users({
      from: r.expenses.paidBy,
      to: r.users.id,
      alias: "paid",
    }),
  },

  categories: {
    expenses: r.many.expenses({
      from: r.categories.id,
      to: r.expenses.category,
    }),
  },
  users: {
    usedExpenses: r.many.expenses({
      from: r.users.id,
      to: r.expenses.usedBy,
      alias: "used",
    }),
    paidExpenses: r.many.expenses({
      from: r.users.id,
      to: r.expenses.paidBy,
      alias: "paid",
    }),
  },
}));
