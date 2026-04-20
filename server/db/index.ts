import { drizzle } from "drizzle-orm/d1";

import { categories, expenses, relations, statements, users } from "./schema";

const schema = {
  categories,
  expenses,
  statements,
  users,
};

export function createDb(d1: D1Database) {
  return drizzle(d1, {
    schema,
    relations,
  });
}

export type Db = ReturnType<typeof createDb>;
