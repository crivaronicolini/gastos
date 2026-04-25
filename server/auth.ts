import type { IncomingRequestCfProperties } from "@cloudflare/workers-types";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as authSchema from "./db/auth.schema";

export type AuthEnv = {
  DB: D1Database;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
};

export function createAuth(env?: AuthEnv, cf?: IncomingRequestCfProperties, baseURL?: string) {
  return betterAuth({
    secret: env?.BETTER_AUTH_SECRET ?? "better-auth-cli-placeholder-secret",
    baseURL,
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        cf: cf ?? {},
        d1: env
          ? {
              db: drizzle(env.DB, { schema: authSchema }),
              options: {
                schema: authSchema,
              },
            }
          : undefined,
      },
      {
        emailAndPassword: {
          enabled: true,
        },
      },
    ),
    ...(env
      ? {}
      : {
          database: drizzleAdapter({} as D1Database, {
            provider: "sqlite",
            schema: authSchema,
          }),
        }),
  });
}

// This export is only used by the Better Auth CLI during schema generation.
// Runtime requests use `createAuth(...)` in `server/app.ts` with request-derived values.
export const auth = createAuth(undefined, undefined, "http://localhost:3000");
