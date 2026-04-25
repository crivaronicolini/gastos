import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import * as React from "react";

import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

type EditableGroupTitleProps = {
  disabled?: boolean;
  groupId: number | null;
  periodLabel?: string | null;
  title: string;
};

export function EditableGroupTitle({
  disabled = false,
  groupId,
  periodLabel,
  title,
}: EditableGroupTitleProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState(title);
  const [isEditing, setIsEditing] = React.useState(false);
  const renameGroupMutation = useMutation({
    mutationFn: async ({ groupId, name }: { groupId: number; name: string }) => {
      const res = await api.groups[":id{[0-9]+}"].$patch({
        json: { name },
        param: { id: String(groupId) },
      });
      if (!res.ok) {
        throw new Error("server error");
      }

      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["get-all-groups"] });
    },
  });

  React.useEffect(() => {
    if (isEditing) return;
    setDraft(title);
  }, [isEditing, title]);

  async function submit() {
    if (!groupId) {
      setIsEditing(false);
      return;
    }

    const nextName = draft.trim();
    if (!nextName || nextName === title) {
      setDraft(title);
      setIsEditing(false);
      return;
    }

    await renameGroupMutation.mutateAsync({ groupId, name: nextName });
    setIsEditing(false);
  }

  return (
    <div className="group flex items-center gap-2">
      <Pencil
        className={`size-4 text-muted-foreground transition-opacity ${
          isEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      />
      {isEditing ? (
        <h2 className="flex items-baseline text-2xl font-semibold tracking-tight">
          <Input
            autoFocus
            className="inline-flex h-auto min-w-0 border-transparent bg-transparent px-0 py-0 text-2xl leading-none font-semibold tracking-tight shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-2xl"
            disabled={disabled || renameGroupMutation.isPending}
            style={{ width: `${Math.max(draft.length, 1)}ch` }}
            value={draft}
            onBlur={() => void submit()}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }

              if (event.key === "Escape") {
                setDraft(title);
                setIsEditing(false);
              }
            }}
          />
          {periodLabel && (
            <span className="ml-3 text-xl font-medium text-muted-foreground">{periodLabel}</span>
          )}
        </h2>
      ) : (
        <button
          type="button"
          className="text-left"
          disabled={disabled || renameGroupMutation.isPending || !groupId}
          onClick={() => setIsEditing(true)}
        >
          <h2 className="text-2xl font-semibold tracking-tight">
            {title}
            {periodLabel && (
              <span className="ml-3 text-xl font-medium text-muted-foreground">{periodLabel}</span>
            )}
          </h2>
        </button>
      )}
    </div>
  );
}
