// apps/web/app/components/DeploymentList.tsx
import type { Deployment } from '@hangar/types';

const STATUS_COLORS: Record<string, string> = {
	pending: '#888',
	building: '#f5a623',
	deploying: '#4a90e2',
	running: '#27ae60',
	failed: '#e74c3c',
};

export function DeploymentList({
	deployments,
	selectedId,
	onSelect,
}: {
	deployments: Deployment[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}) {
	if (deployments.length === 0) {
		return <p style={{ color: '#888' }}>No deployments yet.</p>;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
			{deployments.map((d) => (
				<div
					key={d.id}
					onClick={() => onSelect(d.id)}
					style={{
						padding: '0.75rem 1rem',
						border: `1px solid ${d.id === selectedId ? '#4a90e2' : '#333'}`,
						borderRadius: '4px',
						cursor: 'pointer',
						background: d.id === selectedId ? '#1a1a2e' : 'transparent',
					}}
				>
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
						}}
					>
						<code style={{ fontSize: '0.85rem' }}>{d.id}</code>
						<span
							style={{
								color: STATUS_COLORS[d.status] ?? '#888',
								fontSize: '0.8rem',
								fontWeight: 'bold',
								textTransform: 'uppercase',
							}}
						>
							{d.status}
						</span>
					</div>
					<div
						style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}
					>
						{d.sourceUrl}
					</div>
					{d.liveUrl && (
						<a
							href={d.liveUrl}
							target='_blank'
							rel='noreferrer'
							onClick={(e) => e.stopPropagation()}
							style={{ fontSize: '0.8rem', color: '#4a90e2' }}
						>
							{d.liveUrl}
						</a>
					)}
				</div>
			))}
		</div>
	);
}
