export enum ErrorSeverity {
  High = "high",
  Medium = "medium",
  Low = "low",
}

export enum EmailKind {
  AccessRestricted = "access-restricted",
  AccountDeleted = "account-deleted",
  CollaboratorAdded = "collaborator-added",
  GracePeriodStarted = "grace-period-started",
  PlanUpgraded = "plan-upgraded",
  Welcome = "welcome",
}

export type JsonMap = Record<string, unknown>;
