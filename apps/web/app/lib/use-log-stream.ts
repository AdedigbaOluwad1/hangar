// apps/web/app/lib/useLogStream.ts
import { useState, useEffect } from 'react';

interface LogLine {
	stream: 'build' | 'deploy' | 'system';
	line: string;
}

export function useLogStream(deploymentId: string | null) {
	const [lines, setLines] = useState<LogLine[]>([]);
	const [done, setDone] = useState(false);

	useEffect(() => {
		if (!deploymentId) return;
		setLines([]);
		setDone(false);

		const BASE = typeof window !== 'undefined' ? '' : 'http://api:3001';

		const es = new EventSource(`${BASE}/api/deployments/${deploymentId}/logs`);

		es.addEventListener('log', (e) => {
			setLines((prev) => [...prev, JSON.parse(e.data)]);
		});

		es.addEventListener('done', () => {
			setDone(true);
			es.close();
		});

		es.onerror = () => es.close();

		return () => es.close();
	}, [deploymentId]);

	return { lines, done };
}
