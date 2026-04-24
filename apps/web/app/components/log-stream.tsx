// apps/web/app/components/LogStream.tsx
import { useEffect, useRef } from 'react';
import { useLogStream } from '../lib/use-log-stream';

const STREAM_COLORS = {
	build: '#f5a623',
	deploy: '#4a90e2',
	system: '#888',
};

export function LogStream({ deploymentId }: { deploymentId: string }) {
	const { lines, done } = useLogStream(deploymentId);
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [lines]);

	return (
		<div
			style={{
				background: '#0d0d0d',
				color: '#e0e0e0',
				fontFamily: 'monospace',
				fontSize: '0.8rem',
				padding: '1rem',
				height: '400px',
				overflowY: 'auto',
				borderRadius: '4px',
				border: '1px solid #333',
			}}
		>
			{lines.length === 0 && !done && (
				<span style={{ color: '#555' }}>Waiting for logs...</span>
			)}
			{lines.map((l, i) => (
				<div
					key={i}
					style={{ marginBottom: '2px' }}
				>
					<span style={{ color: STREAM_COLORS[l.stream] ?? '#888' }}>
						[{l.stream}]
					</span>{' '}
					<span style={{ whiteSpace: 'pre-wrap' }}>{l.line}</span>
				</div>
			))}
			{!done && lines.length > 0 && (
				<span style={{ color: '#555', animation: 'pulse 1s infinite' }}>▋</span>
			)}
			<div ref={bottomRef} />
		</div>
	);
}
