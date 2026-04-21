import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  failedWorkflowStatuses,
  type TrackedUpload,
  activeWorkflowStatuses,
} from "@/expenses/upload-tracking";

export function UploadStatusBadge({
  onDismiss,
  onRetry,
  uploads,
}: {
  onDismiss: (uploads: TrackedUpload[]) => void;
  onRetry: (uploads: TrackedUpload[]) => void;
  uploads: TrackedUpload[];
}) {
  const failedUploads = uploads.filter((upload) => failedWorkflowStatuses.has(upload.status));
  if (failedUploads.length > 0) {
    const label = failedUploads.length === 1 ? "Failed" : `${failedUploads.length} failed`;
    const title = failedUploads
      .map((upload) => upload.error?.message ?? `${upload.fileName} failed`)
      .join("\n");

    return (
      <div className="flex items-center gap-2">
        <button type="button" title={title} onClick={() => onRetry(failedUploads)}>
          <Badge variant="destructive">{label}. Retry</Badge>
        </button>
        <button type="button" onClick={() => onDismiss(failedUploads)}>
          <Badge variant="outline">Dismiss</Badge>
        </button>
      </div>
    );
  }

  const activeUploads = uploads.filter((upload) => activeWorkflowStatuses.has(upload.status));
  if (activeUploads.length > 0) {
    const label = activeUploads.length === 1 ? "Processing" : `${activeUploads.length} processing`;

    return (
      <Badge variant="secondary">
        <Spinner data-icon="inline-start" className="size-3" />
        {label}
      </Badge>
    );
  }

  const completedUploads = uploads.filter((upload) => upload.status === "complete");
  if (completedUploads.length > 0) {
    const label = completedUploads.length === 1 ? "Imported" : `${completedUploads.length} imported`;
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline">{label}</Badge>
        <button type="button" onClick={() => onDismiss(completedUploads)}>
          <Badge variant="outline">Dismiss</Badge>
        </button>
      </div>
    );
  }

  return null;
}
