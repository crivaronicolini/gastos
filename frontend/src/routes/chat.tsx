import { useAISDKRuntime } from "@assistant-ui/ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { createFileRoute } from "@tanstack/react-router";
import { useAgent } from "agents/react";

import { Thread } from "@/components/assistant-ui/thread";
import { TooltipProvider } from "@/components/ui/tooltip";
import authClient from "@/lib/auth-client";

export const Route = createFileRoute("/chat")({
  beforeLoad: async () => {
    const session = await authClient.getSession();

    if (!session.data?.session) {
      throw redirect({ to: "/" });
    }
  },
  component: Chat,
});

function Chat() {
  const agent = useAgent({
    agent: "ChatAgent",
    name: "default",
  });

  const chat = useAgentChat({ agent });
  const runtime = useAISDKRuntime(chat);

  return (
    <TooltipProvider>
      <AssistantRuntimeProvider runtime={runtime}>
        <main className="h-dvh">
          <Thread />
        </main>
      </AssistantRuntimeProvider>
    </TooltipProvider>
  );
}
