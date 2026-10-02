import type { Deployment, Build, CreateDeploymentInput, Health } from '@hangar/types';

const BASE = typeof window !== 'undefined' ? '/api' : 'http://api:3001';

async function json<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: res.statusText }));
		throw new Error(body.error ?? `Request failed with ${res.status}`);
	}
	return res.json();
}

export const api = {
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
};
