export type WorkflowStatus =
  | "queued"
  | "running"
  | "paused"
  | "errored"
  | "terminated"
  | "complete"
  | "waiting"
  | "waitingForPause"
  | "unknown";

export type WorkflowError = {
  message: string;
  name?: string;
};

export type TrackedUpload = {
  completedAt?: number;
  error?: WorkflowError | null;
  fileKey: string;
  fileName: string;
  groupId: number;
  ownerId: number;
  status: WorkflowStatus;
  workflowId: string;
};

export const activeWorkflowStatuses = new Set<WorkflowStatus>([
  "queued",
  "running",
  "paused",
  "waiting",
  "waitingForPause",
]);

export const failedWorkflowStatuses = new Set<WorkflowStatus>(["errored", "terminated", "unknown"]);

export type WorkflowStatusResponse = {
  statuses: Array<{
    error?: WorkflowError | null;
    id: string;
    status: WorkflowStatus;
  }>;
};
