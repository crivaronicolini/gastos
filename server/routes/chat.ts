import type { AppEnv } from "@server/app";

import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { routeAgentRequest, type Schedule } from "agents";
import { getSchedulePrompt, scheduleSchema } from "agents/schedule";
import { convertToModelMessages, pruneMessages, stepCountIs, streamText, tool } from "ai";
import { Hono } from "hono";
import { z } from "zod";

type ChatEnv = Env & { OPENROUTER_API_KEY: string };

export class ChatAgent extends AIChatAgent<ChatEnv> {
  override maxPersistedMessages = 100;
  chatRecovery = true;
  override async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const openrouter = createOpenRouter({
      apiKey: this.env.OPENROUTER_API_KEY,
    });

    const result = streamText({
      model: openrouter("dots-studio/dots-3-note-preview:free"),
      system: `You are a helpful assistant that can understand images. You can check the weather, get the user's timezone, run calculations, and schedule tasks. When users share images, describe what you see and answer questions about them.

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.`,
      // Prune old tool calls and reasoning to save tokens on long conversations
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        toolCalls: "before-last-2-messages",
        reasoning: "before-last-message",
      }),
      tools: {
        // Server-side tool: runs automatically on the server
        getWeather: tool({
          description: "Get the current weather for a city",
          inputSchema: z.object({
            city: z.string().describe("City name"),
          }),
          execute: async ({ city }) => {
            // Replace with a real weather API in production
            const conditions = ["sunny", "cloudy", "rainy", "snowy"];
            const temp = Math.floor(Math.random() * 30) + 5;
            return {
              city,
              temperature: temp,
              condition: conditions[Math.floor(Math.random() * conditions.length)],
              unit: "celsius",
            };
          },
        }),

        // Client-side tool: no execute function — the browser handles it
        getUserTimezone: tool({
          description:
            "Get the user's timezone from their browser. Use this when you need to know the user's local time.",
          inputSchema: z.object({}),
        }),

        // Approval tool: requires user confirmation before executing
        calculate: tool({
          description:
            "Perform a math calculation with two numbers. Requires user approval for large numbers.",
          inputSchema: z.object({
            a: z.number().describe("First number"),
            b: z.number().describe("Second number"),
            operator: z.enum(["+", "-", "*", "/", "%"]).describe("Arithmetic operator"),
          }),
          needsApproval: async ({ a, b }) => Math.abs(a) > 1000 || Math.abs(b) > 1000,
          execute: async ({ a, b, operator }) => {
            const ops: Record<string, (x: number, y: number) => number> = {
              "+": (x, y) => x + y,
              "-": (x, y) => x - y,
              "*": (x, y) => x * y,
              "/": (x, y) => x / y,
              "%": (x, y) => x % y,
            };
            if (operator === "/" && b === 0) {
              return { error: "Division by zero" };
            }
            return {
              expression: `${a} ${operator} ${b}`,
              result: ops[operator](a, b),
            };
          },
        }),

        scheduleTask: tool({
          description:
            "Schedule a task to be executed at a later time. Use this when the user asks to be reminded or wants something done later.",
          inputSchema: scheduleSchema,
          execute: async ({ when, description }) => {
            if (when.type === "no-schedule") {
              return "Not a valid schedule input";
            }
            const input =
              when.type === "scheduled"
                ? when.date
                : when.type === "delayed"
                  ? when.delayInSeconds
                  : when.type === "cron"
                    ? when.cron
                    : null;
            if (!input) return "Invalid schedule type";
            try {
              this.schedule(input, "executeTask", description, {
                idempotent: true,
              });
              return `Task scheduled: "${description}" (${when.type}: ${input})`;
            } catch (error) {
              return `Error scheduling task: ${error}`;
            }
          },
        }),

        getScheduledTasks: tool({
          description: "List all tasks that have been scheduled",
          inputSchema: z.object({}),
          execute: async () => {
            const tasks = this.getSchedules();
            return tasks.length > 0 ? tasks : "No scheduled tasks found.";
          },
        }),

        cancelScheduledTask: tool({
          description: "Cancel a scheduled task by its ID",
          inputSchema: z.object({
            taskId: z.string().describe("The ID of the task to cancel"),
          }),
          execute: async ({ taskId }) => {
            try {
              this.cancelSchedule(taskId);
              return `Task ${taskId} cancelled.`;
            } catch (error) {
              return `Error cancelling task: ${error}`;
            }
          },
        }),
      },
      stopWhen: stepCountIs(20),
      abortSignal: options?.abortSignal,
    });

    return result.toUIMessageStreamResponse();
  }

  async executeTask(description: string, _task: Schedule<string>) {
    // Do the actual work here (send email, call API, etc.)
    console.log(`Executing scheduled task: ${description}`);

    // Notify connected clients via a broadcast event.
    // We use broadcast() instead of saveMessages() to avoid injecting
    // into chat history — that would cause the AI to see the notification
    // as new context and potentially loop.
    this.broadcast(
      JSON.stringify({
        type: "scheduled-task",
        description,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

export const chatRoute = new Hono<AppEnv>().all("/*", async (c) => {
  if (!c.get("session")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Pass the original request through unchanged: routeAgentRequest handles both
  // HTTP and WebSocket upgrades, including their connection headers.
  return (await routeAgentRequest(c.req.raw, c.env)) ?? c.json({ error: "Not found" }, 404);
});
