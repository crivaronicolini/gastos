import type { AppEnv } from "@server/app";

import { Hono } from "hono";

export const pdfCompleteRoute = new Hono<AppEnv>().post("/webhook", (c) => {
  const res = c.req.raw;
  console.log(res);
  return new Response("File uploaded successfully", { status: 200 });
});

export const uploadRoute = new Hono<AppEnv>().post("/", async (c) => {
  const body = await c.req.parseBody({ all: true });
  const value = body["file"];

  const files = Array.isArray(value)
    ? value.filter((item): item is File => item instanceof File)
    : value instanceof File
      ? [value]
      : [];

  if (files.length === 0) {
    return c.text("At least one file is required", 400);
  }

  const instances = await Promise.all(
    files.map(async (file) => {
      const id = crypto.randomUUID();
      const upload = await c.env.R2.put(id.slice(0, 5) + "-" + file.name, file);
      return { id, params: { file_url: upload?.key } };
    }),
  );

  await c.env.process_files_WF.createBatch(instances);
  return new Response("File uploaded successfully", { status: 200 });
});
