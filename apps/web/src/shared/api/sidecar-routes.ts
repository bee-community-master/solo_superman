import type {
  AutoImplementationStage,
  ProjectId,
  ResearchAllowlistId,
  ResearchRunId,
  SessionId
} from "@solo-superman/contracts";

export function researchAllowlistCollectionPath(projectId: ProjectId) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/research-allowlists`;
}

export function researchAllowlistMemberPath(projectId: ProjectId, allowlistId: ResearchAllowlistId) {
  return `${researchAllowlistCollectionPath(projectId)}/${encodeURIComponent(allowlistId)}`;
}

export function researchAllowlistPausePath(projectId: ProjectId, allowlistId: ResearchAllowlistId) {
  return `${researchAllowlistMemberPath(projectId, allowlistId)}/pause`;
}

export function researchAllowlistRevokePath(projectId: ProjectId, allowlistId: ResearchAllowlistId) {
  return `${researchAllowlistMemberPath(projectId, allowlistId)}/revoke`;
}

export function researchDisclosureCollectionPath(projectId: ProjectId) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/research-disclosures`;
}

export function researchRunCollectionPath(projectId: ProjectId) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/research-runs`;
}

export function phase15bUpgradeHintCollectionPath(projectId: ProjectId) {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/phase15b-upgrade-hints`;
}

export function phase15bUpgradeHintExportPath(projectId: ProjectId) {
  return `${phase15bUpgradeHintCollectionPath(projectId)}/export`;
}

export function planningHandoffPath(sessionId: SessionId) {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/planning-handoff`;
}

export function chatGptBrowserDelegationPath(sessionId: SessionId) {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/chatgpt-browser-delegations`;
}

export function chatGptBrowserDelegationRunRevokePath(sessionId: SessionId, runId: string) {
  return `${chatGptBrowserDelegationPath(sessionId)}/${encodeURIComponent(runId)}/revoke`;
}

export function servicePageUsePermissionPath(sessionId: SessionId) {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/service-page-use-permissions`;
}

export function servicePageUsePermissionRevokePath(sessionId: SessionId, permissionId: string) {
  return `${servicePageUsePermissionPath(sessionId)}/${encodeURIComponent(permissionId)}/revoke`;
}

export function servicePageUsePermissionArtifactDeletePath(sessionId: SessionId, permissionId: string) {
  return `${servicePageUsePermissionPath(sessionId)}/${encodeURIComponent(permissionId)}/artifacts/delete`;
}

export function implementationStepLedgerPath(sessionId: SessionId) {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/implementation-step-ledger`;
}

export function autoImplementationRunPath(sessionId: SessionId) {
  return `/api/v1/sessions/${encodeURIComponent(sessionId)}/auto-implementation-runs`;
}

export function autoImplementationWorkerJobPath(sessionId: SessionId, runId: string) {
  return `${autoImplementationRunPath(sessionId)}/${encodeURIComponent(runId)}/worker-jobs`;
}

export function autoImplementationWorkerJobCompletePath(sessionId: SessionId, runId: string, jobId: string) {
  return `${autoImplementationWorkerJobPath(sessionId, runId)}/${encodeURIComponent(jobId)}/complete`;
}

export function autoImplementationStagePath(sessionId: SessionId, runId: string, stage: AutoImplementationStage) {
  return `${autoImplementationRunPath(sessionId)}/${encodeURIComponent(runId)}/stages/${encodeURIComponent(stage)}`;
}

export function sessionEventStreamPath(sessionId: SessionId) {
  return `/api/v1/events/stream?${new URLSearchParams({ sessionId }).toString()}`;
}

export function researchRunStatusPath(projectId: ProjectId, researchRunId: ResearchRunId) {
  return `${researchRunCollectionPath(projectId)}/${encodeURIComponent(researchRunId)}/status`;
}

export function researchRunControlPath(projectId: ProjectId, researchRunId: ResearchRunId, action: "cancel" | "retry") {
  return `${researchRunCollectionPath(projectId)}/${encodeURIComponent(researchRunId)}/${action}`;
}
