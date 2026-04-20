import { defineRelations } from "drizzle-orm";
import { int, integer, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-orm/zod";
import { z, toJSONSchema } from "zod";

export const categories = sqliteTable("categories", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
});

export const users = sqliteTable("users", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
});

export const statements = sqliteTable("statements", {
  id: int().primaryKey({ autoIncrement: true }),
  bank: text(),
  card: text(),
  owner: int().references(() => users.id),
  periodFrom: integer({ mode: "timestamp" }),
  periodTo: integer({ mode: "timestamp" }),
  month: text(),
  sourceFileKey: text(),
  jsonFileKey: text(),
  createdAt: integer({ mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const expenses = sqliteTable("expenses", {
  id: int().primaryKey({ autoIncrement: true }),
  statement: int().references(() => statements.id),
  origin: text().notNull(),
  title: text().notNull(),
  amount: numeric({ mode: "number" }),
  date: integer({ mode: "timestamp" }),
  installments: text(),
  category: int().references(() => categories.id),
  usedBy: int().references(() => users.id),
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

export const statementSelectSchema = createSelectSchema(statements);
export const statementInsertSchema = createInsertSchema(statements, {
  periodFrom: z.coerce.date().optional().nullable(),
  periodTo: z.coerce.date().optional().nullable(),
});
export const statementUpdateSchema = createUpdateSchema(statements, {
  periodFrom: z.coerce.date().optional().nullable(),
  periodTo: z.coerce.date().optional().nullable(),
});

export type Statement = z.infer<typeof statementSelectSchema>;
export type StatementInsert = z.infer<typeof statementInsertSchema>;
export type StatementUpdate = z.infer<typeof statementUpdateSchema>;

export const categoryNames = [
  "Comida",
  "Regalos",
  "Salidas",
  "Rappi/comida en casa",
  "Vivienda",
  "Salud/médicos",
  "Ropa",
  "Mascotas",
  "Servicios",
  "Transporte",
  "Deuda",
  "Viajes",
  "Hobbys",
  "Otros",
] as const;

export const statementImportExpenseSchema = expenseInsertSchema
  .pick({
    title: true,
  })
  .extend({
    amount: z.number().nullable(),
    amount_usd: z.number().nullable(),
    category: z.enum(categoryNames),
    date: z.string().nullable(),
    installments: expenseInsertSchema.shape.installments.unwrap(),
  })
  .strict()
  .refine((expense) => expense.amount !== null || expense.amount_usd !== null, {
    message: "Either amount or amount_usd is required",
    path: ["amount"],
  });

export const statementImportSchema = z
  .object({
    bank: statementInsertSchema.shape.bank.unwrap(),
    card: statementInsertSchema.shape.card.unwrap(),
    expenses: z.array(statementImportExpenseSchema),
    month: statementInsertSchema.shape.month.unwrap(),
    period_from: z.string().nullable(),
    period_to: z.string().nullable(),
  })
  .strict();

export const uploadWebhookSchema = z
  .object({
    file_key: z.string().min(1),
    json_key: z.string().min(1),
    owner_id: z.number().int().positive(),
  })
  .strict();

export type StatementImport = z.infer<typeof statementImportSchema>;
export type StatementImportExpense = z.infer<typeof statementImportExpenseSchema>;
export type UploadWebhookPayload = z.infer<typeof uploadWebhookSchema>;

export const statementImportJsonSchema = {
  name: "expense_list",
  strict: true,
  schema: toJSONSchema(statementImportSchema, { target: "draft-7" }),
} as const;

export const relations = defineRelations({ expenses, categories, users, statements }, (r) => ({
  expenses: {
    statementData: r.one.statements({
      from: r.expenses.statement,
      to: r.statements.id,
    }),
    categoryData: r.one.categories({
      from: r.expenses.category,
      to: r.categories.id,
    }),
    usedByUser: r.one.users({
      from: r.expenses.usedBy,
      to: r.users.id,
      alias: "used",
    }),
  },

  categories: {
    expenses: r.many.expenses({
      from: r.categories.id,
      to: r.expenses.category,
    }),
  },
  users: {
    statements: r.many.statements({
      from: r.users.id,
      to: r.statements.owner,
    }),
    usedExpenses: r.many.expenses({
      from: r.users.id,
      to: r.expenses.usedBy,
      alias: "used",
    }),
  },
  statements: {
    ownerUser: r.one.users({
      from: r.statements.owner,
      to: r.users.id,
    }),
    expenses: r.many.expenses({
      from: r.statements.id,
      to: r.expenses.statement,
    }),
  },
}));
