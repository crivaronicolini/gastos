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

export const groups = sqliteTable("groups", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  createdAt: integer({ mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const groupMembers = sqliteTable("group_members", {
  id: int().primaryKey({ autoIncrement: true }),
  group: int("groupId").references(() => groups.id),
  user: int("userId").references(() => users.id),
  role: text().notNull().default("member"),
  createdAt: integer({ mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const usageTargets = sqliteTable("usage_targets", {
  id: int().primaryKey({ autoIncrement: true }),
  group: int("groupId").references(() => groups.id),
  name: text().notNull(),
  type: text().notNull(),
  user: int("userId").references(() => users.id),
  createdAt: integer({ mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const statements = sqliteTable("statements", {
  id: int().primaryKey({ autoIncrement: true }),
  group: int("groupId").references(() => groups.id),
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
  currency: text().notNull().default("ARS"),
  date: integer({ mode: "timestamp" }),
  installments: text(),
  category: int().references(() => categories.id),
  usedByTarget: int().references(() => usageTargets.id),
});

export const expenseSelectSchema = createSelectSchema(expenses);
export const expenseInsertSchema = createInsertSchema(expenses, {
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  date: z.coerce.date().optional().nullable(),
});
export const expenseUpdateSchema = createUpdateSchema(expenses, {
  currency: z.enum(["ARS", "USD"]).optional(),
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

export const groupSelectSchema = createSelectSchema(groups);
export const groupInsertSchema = createInsertSchema(groups, {
  createdAt: z.coerce.date().optional(),
});
export const groupUpdateSchema = createUpdateSchema(groups, {
  createdAt: z.coerce.date().optional(),
});

export type Group = z.infer<typeof groupSelectSchema>;
export type GroupInsert = z.infer<typeof groupInsertSchema>;
export type GroupUpdate = z.infer<typeof groupUpdateSchema>;

export const groupMemberSelectSchema = createSelectSchema(groupMembers);
export const groupMemberInsertSchema = createInsertSchema(groupMembers, {
  createdAt: z.coerce.date().optional(),
});
export const groupMemberUpdateSchema = createUpdateSchema(groupMembers, {
  createdAt: z.coerce.date().optional(),
});

export type GroupMember = z.infer<typeof groupMemberSelectSchema>;
export type GroupMemberInsert = z.infer<typeof groupMemberInsertSchema>;
export type GroupMemberUpdate = z.infer<typeof groupMemberUpdateSchema>;

export const usageTargetTypes = ["member", "group"] as const;

export const usageTargetSelectSchema = createSelectSchema(usageTargets, {
  type: z.enum(usageTargetTypes),
});
export const usageTargetInsertSchema = createInsertSchema(usageTargets, {
  createdAt: z.coerce.date().optional(),
  type: z.enum(usageTargetTypes),
});
export const usageTargetUpdateSchema = createUpdateSchema(usageTargets, {
  createdAt: z.coerce.date().optional(),
  type: z.enum(usageTargetTypes).optional(),
});

export type UsageTarget = z.infer<typeof usageTargetSelectSchema>;
export type UsageTargetInsert = z.infer<typeof usageTargetInsertSchema>;
export type UsageTargetUpdate = z.infer<typeof usageTargetUpdateSchema>;

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
    currency: true,
    title: true,
  })
  .extend({
    amount: z.number(),
    category: z.enum(categoryNames),
    date: z.string().nullable(),
    installments: expenseInsertSchema.shape.installments.unwrap(),
  })
  .strict();

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
    group_id: z.number().int().positive(),
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

export const relations = defineRelations(
  { expenses, categories, users, groups, groupMembers, statements, usageTargets },
  (r) => ({
  expenses: {
    statementData: r.one.statements({
      from: r.expenses.statement,
      to: r.statements.id,
    }),
    categoryData: r.one.categories({
      from: r.expenses.category,
      to: r.categories.id,
    }),
    usedByTargetData: r.one.usageTargets({
      from: r.expenses.usedByTarget,
      to: r.usageTargets.id,
    }),
  },

  categories: {
    expenses: r.many.expenses({
      from: r.categories.id,
      to: r.expenses.category,
    }),
  },
  users: {
    groupMemberships: r.many.groupMembers({
      from: r.users.id,
      to: r.groupMembers.user,
    }),
    statements: r.many.statements({
      from: r.users.id,
      to: r.statements.owner,
    }),
    usageTargets: r.many.usageTargets({
      from: r.users.id,
      to: r.usageTargets.user,
    }),
  },
  groups: {
    members: r.many.groupMembers({
      from: r.groups.id,
      to: r.groupMembers.group,
    }),
    statements: r.many.statements({
      from: r.groups.id,
      to: r.statements.group,
    }),
    usageTargets: r.many.usageTargets({
      from: r.groups.id,
      to: r.usageTargets.group,
    }),
  },
  groupMembers: {
    groupData: r.one.groups({
      from: r.groupMembers.group,
      to: r.groups.id,
    }),
    userData: r.one.users({
      from: r.groupMembers.user,
      to: r.users.id,
    }),
  },
  statements: {
    groupData: r.one.groups({
      from: r.statements.group,
      to: r.groups.id,
    }),
    ownerUser: r.one.users({
      from: r.statements.owner,
      to: r.users.id,
    }),
    expenses: r.many.expenses({
      from: r.statements.id,
      to: r.expenses.statement,
    }),
  },
  usageTargets: {
    groupData: r.one.groups({
      from: r.usageTargets.group,
      to: r.groups.id,
    }),
    userData: r.one.users({
      from: r.usageTargets.user,
      to: r.users.id,
    }),
    expenses: r.many.expenses({
      from: r.usageTargets.id,
      to: r.expenses.usedByTarget,
    }),
  },
}));
