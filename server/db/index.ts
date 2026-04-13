import { drizzle } from "drizzle-orm/bun-sqlite";

export const db = drizzle(Bun.env.DB_FILE_NAME!);
