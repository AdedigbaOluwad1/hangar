// apps/web/app/routes/_index.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DeployForm } from '../components/deploy-form';
import { DeploymentList } from '../components/deployment-list';
import { LogStream } from '../components/log-stream';

export default function Index() {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const { data: deployments = [] } = useQuery({
		queryKey: ['deployments'],
		queryFn: api.listDeployments,
		refetchInterval: (query) => {
			const hasActive = query.state.data?.some((d) =>
				['pending', 'building', 'deploying'].includes(d.status),
			);
			return hasActive ? 2000 : 10000;
		},
	});

	return (
		<div
			style={{
				maxWidth: '900px',
				margin: '0 auto',
				padding: '2rem',
				fontFamily: 'sans-serif',
			}}
		>
			<h1 style={{ marginBottom: '2rem' }}>⚓ Hangar</h1>

			<DeployForm onDeployed={(id) => setSelectedId(id)} />

			<div
				style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}
			>
				<div>
					<h2>Deployments</h2>
					<DeploymentList
						deployments={deployments}
						selectedId={selectedId}
						onSelect={setSelectedId}
					/>
				</div>

				<div>
					<h2>
						Logs{' '}
						{selectedId && (
							<code style={{ fontSize: '0.8rem' }}>{selectedId}</code>
						)}
					</h2>
					{selectedId ? (
						<LogStream deploymentId={selectedId} />
					) : (
						<p style={{ color: '#888' }}>Select a deployment to view logs</p>
					)}
				</div>
			</div>
		</div>
	);
}
