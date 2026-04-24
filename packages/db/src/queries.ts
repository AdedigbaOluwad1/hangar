import { db } from './index';
import type { Deployment, LogLine, DeploymentStatus } from '@hangar/types';

// ── Deployments ──────────────────────────────────────────

export function createDeployment(data: {
	id: string;
	sourceType: 'git' | 'zip';
	sourceUrl: string | null;
}): Deployment {
	db.prepare(
		`
    INSERT INTO deployments (id, source_type, source_url)
    VALUES (@id, @sourceType, @sourceUrl)
  `,
	).run(data);

	return getDeployment(data.id)!;
}

export function getDeployment(id: string): Deployment | null {
	const row = db
		.prepare(
			`
    SELECT * FROM deployments WHERE id = ?
  `,
		)
		.get(id) as any;

	return row ? rowToDeployment(row) : null;
}

export function listDeployments(): Deployment[] {
	const rows = db
		.prepare(
			`
    SELECT * FROM deployments ORDER BY created_at DESC
  `,
		)
		.all() as any[];

	return rows.map(rowToDeployment);
}

export function updateDeployment(
	id: string,
	data: Partial<{
		status: DeploymentStatus;
		imageTag: string;
		containerId: string;
		port: number;
		liveUrl: string;
	}>,
): void {
	const fields = Object.entries(data)
		.map(([k, _]) => `${toSnake(k)} = @${k}`)
		.join(', ');

	db.prepare(
		`
    UPDATE deployments
    SET ${fields}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `,
	).run({ ...data, id });
}

// ── Logs ─────────────────────────────────────────────────

export function writeLog(
	deploymentId: string,
	stream: LogLine['stream'],
	line: string,
): void {
	db.prepare(
		`
    INSERT INTO logs (deployment_id, stream, line)
    VALUES (?, ?, ?)
  `,
	).run(deploymentId, stream, line);
}

export function getLogs(deploymentId: string): LogLine[] {
	const rows = db
		.prepare(
			`
    SELECT * FROM logs WHERE deployment_id = ? ORDER BY id ASC
  `,
		)
		.all(deploymentId) as any[];

	return rows.map((r) => ({
		deploymentId: r.deployment_id,
		stream: r.stream,
		line: r.line,
		createdAt: r.created_at,
	}));
}

// ── Helpers ───────────────────────────────────────────────

function toSnake(camel: string): string {
	return camel.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
}

function rowToDeployment(row: any): Deployment {
	return {
		id: row.id,
		status: row.status,
		sourceType: row.source_type,
		sourceUrl: row.source_url,
		imageTag: row.image_tag,
		containerId: row.container_id,
		port: row.port,
		liveUrl: row.live_url,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}
