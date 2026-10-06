import type {
	Deployment,
	Build,
	CreateDeploymentInput,
	Health,
	Database,
	DatabaseDetail,
	DatabaseAttachment,
	DatabaseBackup,
	DeploymentAttachment,
	CreateDatabaseInput,
} from '@hangar/types';

const BASE = typeof window !== 'undefined' ? '/api' : 'http://api:3001';

export class UnauthorizedError extends Error {
	constructor() {
		super('Sign in to continue');
	}
}

async function json<T>(res: Response): Promise<T> {
	if (res.status === 401) throw new UnauthorizedError();
	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: res.statusText }));
		throw new Error(body.error ?? `Request failed with ${res.status}`);
	}
	return res.json();
}

export const api = {
	getSession: (): Promise<{ ok: true }> => fetch(`${BASE}/auth/session`).then((r) => json(r)),

	signIn: (token: string): Promise<{ ok: true }> =>
		fetch(`${BASE}/auth/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token }),
		}).then((r) => json(r)),

	signOut: (): Promise<{ ok: true }> => fetch(`${BASE}/auth/logout`, { method: 'POST' }).then((r) => json(r)),

	listDeployments: (): Promise<Deployment[]> => fetch(`${BASE}/deployments`).then((r) => json(r)),

	getDeployment: (id: string): Promise<Deployment> => fetch(`${BASE}/deployments/${id}`).then((r) => json(r)),

	createDeployment: (body: CreateDeploymentInput): Promise<Deployment> =>
		fetch(`${BASE}/deployments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}).then((r) => json(r)),

	renameDeployment: (id: string, callsign: string): Promise<Deployment> =>
		fetch(`${BASE}/deployments/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ callsign }),
		}).then((r) => json(r)),

	deleteDeployment: (id: string): Promise<{ message: string }> =>
		fetch(`${BASE}/deployments/${id}`, { method: 'DELETE' }).then((r) => json(r)),

	redeploy: (id: string): Promise<Deployment> =>
		fetch(`${BASE}/deployments/${id}/redeploy`, { method: 'POST' }).then((r) => json(r)),

	rollback: (id: string, tag: string): Promise<Deployment> =>
		fetch(`${BASE}/deployments/${id}/rollback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tag }),
		}).then((r) => json(r)),

	getHealth: (id: string): Promise<Health> => fetch(`${BASE}/deployments/${id}/health`).then((r) => json(r)),

	getTags: (id: string): Promise<{ tags: string[] }> => fetch(`${BASE}/deployments/${id}/tags`).then((r) => json(r)),

	listBuilds: (id: string): Promise<Build[]> => fetch(`${BASE}/deployments/${id}/builds`).then((r) => json(r)),

	getBuild: (id: string, buildId: string): Promise<Build> =>
		fetch(`${BASE}/deployments/${id}/builds/${buildId}`).then((r) => json(r)),

	listDatabases: (): Promise<DatabaseDetail[]> => fetch(`${BASE}/databases`).then((r) => json(r)),

	getDatabase: (id: string): Promise<DatabaseDetail> => fetch(`${BASE}/databases/${id}`).then((r) => json(r)),

	createDatabase: (body: CreateDatabaseInput): Promise<Database> =>
		fetch(`${BASE}/databases`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}).then((r) => json(r)),

	deleteDatabase: (id: string): Promise<Database> =>
		fetch(`${BASE}/databases/${id}`, { method: 'DELETE' }).then((r) => json(r)),

	listBackups: (id: string): Promise<DatabaseBackup[]> => fetch(`${BASE}/databases/${id}/backups`).then((r) => json(r)),

	listAttachments: (deploymentId: string): Promise<DeploymentAttachment[]> =>
		fetch(`${BASE}/deployments/${deploymentId}/attachments`).then((r) => json(r)),

	attachDatabase: (deploymentId: string, body: { databaseId: string; envName?: string }): Promise<DatabaseAttachment> =>
		fetch(`${BASE}/deployments/${deploymentId}/attachments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}).then((r) => json(r)),

	detachDatabase: (deploymentId: string, attachmentId: string): Promise<DatabaseAttachment> =>
		fetch(`${BASE}/deployments/${deploymentId}/attachments/${attachmentId}`, { method: 'DELETE' }).then((r) => json(r)),

	restoreDatabase: (id: string, backupId: string): Promise<Database> =>
		fetch(`${BASE}/databases/${id}/restore`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ backupId }),
		}).then((r) => json(r)),

	backUpNow: (id: string): Promise<DatabaseBackup> =>
		fetch(`${BASE}/databases/${id}/backups`, { method: 'POST' }).then((r) => json(r)),
};
