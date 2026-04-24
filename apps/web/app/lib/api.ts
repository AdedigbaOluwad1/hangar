// apps/web/app/lib/api.ts
import type { Deployment, CreateDeploymentInput } from '@hangar/types';

const BASE = typeof window !== 'undefined' ? '/api' : 'http://api:3001';

export const api = {
	listDeployments: (): Promise<Deployment[]> =>
		fetch(`${BASE}/deployments`).then((r) => r.json()),

	getDeployment: (id: string): Promise<Deployment> =>
		fetch(`${BASE}/deployments/${id}`).then((r) => r.json()),

	createDeployment: (body: CreateDeploymentInput): Promise<Deployment> =>
		fetch(`${BASE}/deployments`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}).then((r) => r.json()),
};
