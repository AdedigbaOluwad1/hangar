// apps/web/app/components/DeployForm.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function DeployForm({
	onDeployed,
}: {
	onDeployed: (id: string) => void;
}) {
	const [url, setUrl] = useState('');
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: () =>
			api.createDeployment({ sourceType: 'git', sourceUrl: url }),
		onSuccess: (deployment) => {
			queryClient.invalidateQueries({ queryKey: ['deployments'] });
			onDeployed(deployment.id);
			setUrl('');
		},
	});

	return (
		<div style={{ marginBottom: '2rem' }}>
			<h2>New Deployment</h2>
			<div style={{ display: 'flex', gap: '0.5rem' }}>
				<input
					type='text'
					placeholder='https://github.com/user/repo'
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					style={{ flex: 1, padding: '0.5rem' }}
				/>
				<button
					onClick={() => mutation.mutate()}
					disabled={!url || mutation.isPending}
					style={{ padding: '0.5rem 1rem' }}
				>
					{mutation.isPending ? 'Deploying...' : 'Deploy'}
				</button>
			</div>
			{mutation.isError && (
				<p style={{ color: 'red' }}>Failed to create deployment</p>
			)}
		</div>
	);
}
