import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, Cancel01Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { api } from '../lib/api';
import { paths } from '../lib/paths';
import { repoName } from '../lib/format';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface EnvRow {
	key: string;
	value: string;
}

function Section({
	n,
	title,
	description,
	children,
}: {
	n: string;
	title: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<section data-reveal className="border-t border-line px-5 py-7 first:border-t-0 md:px-7">
			<div className="flex items-baseline gap-3">
				<span className="font-code text-mono text-deck-400">{n}</span>
				<div>
					<h2 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h2>
					{description && <p className="mt-1 text-sm text-steel-400">{description}</p>}
				</div>
			</div>
			<div className="mt-5">{children}</div>
		</section>
	);
}

export function DeployForm() {
	const [url, setUrl] = useState('');
	const [envRows, setEnvRows] = useState<EnvRow[]>([]);
	const [cpu, setCpu] = useState('');
	const [memoryMb, setMemoryMb] = useState('');
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const mutation = useMutation({
		mutationFn: () => {
			const env = Object.fromEntries(
				envRows.filter((row) => row.key.trim().length > 0).map((row) => [row.key.trim(), row.value]),
			);

			const resources =
				cpu || memoryMb
					? {
							...(cpu ? { cpu: Number(cpu) } : {}),
							...(memoryMb ? { memoryMb: Number(memoryMb) } : {}),
						}
					: undefined;

			return api.createDeployment({
				sourceType: 'git',
				sourceUrl: url,
				env: Object.keys(env).length > 0 ? env : undefined,
				resources,
			});
		},
		onSuccess: (deployment) => {
			queryClient.invalidateQueries({ queryKey: ['deployments'] });
			toast.success(`${deployment.callsign} is cleared for launch`, { description: deployment.id });
			navigate(paths.deployment(deployment.id));
		},
	});

	function updateRow(index: number, field: keyof EnvRow, value: string) {
		setEnvRows((rows) => {
			const next = [...rows];
			next[index] = { ...next[index], [field]: value };
			return next;
		});
	}

	function removeRow(index: number) {
		setEnvRows((rows) => rows.filter((_, i) => i !== index));
	}

	const repo = repoName(url);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				mutation.mutate();
			}}
			className="panel overflow-hidden"
		>
			<Section n="01" title="Source" description="The Git repository to build. Railpack works out how.">
				<Label htmlFor="repo-url" className="mb-2.5">
					Repository URL
				</Label>
				<Input
					id="repo-url"
					type="url"
					required
					autoFocus
					placeholder="https://github.com/you/app"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					className="font-code"
				/>
				<p className="mt-2 h-4 font-code text-mono text-steel-500">
					{repo && (
						<>
							<span className="text-deck-400">›</span> airframe <span className="text-steel-100">{repo}</span>
						</>
					)}
				</p>
			</Section>

			<Section n="02" title="Environment" description="Stored in Vault and injected into the container at runtime.">
				<div className="flex flex-col gap-2">
					{envRows.map((row, i) => (
						<div key={i} className="flex gap-2">
							<Input
								type="text"
								aria-label={`Variable ${i + 1} name`}
								placeholder="KEY"
								value={row.key}
								onChange={(e) => updateRow(i, 'key', e.target.value)}
								autoComplete="off"
								spellCheck={false}
								className="w-2/5 font-code uppercase placeholder:normal-case"
							/>
							<Input
								type="text"
								aria-label={`Variable ${i + 1} value`}
								placeholder="value"
								value={row.value}
								onChange={(e) => updateRow(i, 'value', e.target.value)}
								autoComplete="off"
								spellCheck={false}
								className="flex-1 font-code"
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onClick={() => removeRow(i)}
								aria-label={`Remove variable ${i + 1}`}
								className="size-11 rounded-lg border-input text-steel-500 not-disabled:hover:translate-y-0 hover:border-destructive/50 hover:bg-destructive/[0.06] hover:text-destructive"
							>
								<HugeiconsIcon icon={Cancel01Icon} />
							</Button>
						</div>
					))}
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => setEnvRows((rows) => [...rows, { key: '', value: '' }])}
					className="mt-3 -ml-3 font-code text-mono tracking-[0.16em] text-deck-400 uppercase hover:bg-deck-400/[0.08] hover:text-deck-300"
				>
					<HugeiconsIcon icon={PlusSignIcon} />
					Add variable
				</Button>
			</Section>

			<Section n="03" title="Resources" description="Leave blank for the defaults: 500 MHz and 512 MB.">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<Label htmlFor="cpu" className="mb-2.5">
							CPU · MHz
						</Label>
						<Input
							id="cpu"
							type="number"
							min={100}
							max={8000}
							placeholder="500"
							value={cpu}
							onChange={(e) => setCpu(e.target.value)}
							className="font-code tabular-nums"
						/>
					</div>
					<div>
						<Label htmlFor="memory" className="mb-2.5">
							Memory · MB
						</Label>
						<Input
							id="memory"
							type="number"
							min={128}
							max={32768}
							placeholder="512"
							value={memoryMb}
							onChange={(e) => setMemoryMb(e.target.value)}
							className="font-code tabular-nums"
						/>
					</div>
				</div>
			</Section>

			<div className="flex flex-col-reverse gap-4 border-t border-line bg-night-850/60 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
				<p role="alert" className="font-code text-xs text-alarm-400">
					{mutation.isError &&
						(mutation.error instanceof Error ? mutation.error.message : 'Failed to create deployment')}
				</p>
				<Button type="submit" disabled={!url || mutation.isPending}>
					{mutation.isPending ? (
						<>
							<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-night-950/30 border-t-night-950" />
							Launching…
						</>
					) : (
						<>
							Launch
							<HugeiconsIcon icon={ArrowRight01Icon} />
						</>
					)}
				</Button>
			</div>
		</form>
	);
}
