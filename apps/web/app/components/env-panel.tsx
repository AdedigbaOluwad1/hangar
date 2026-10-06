import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, LockIcon, PlusSignIcon, Undo02Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { api, type EnvPatchResult } from '../lib/api';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface NewRow {
	key: string;
	value: string;
}

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RESERVED = [/^PORT$/, /^HANGAR_/, /^NOMAD_/];

const APPLY_COPY: Record<EnvPatchResult['apply'], string> = {
	restarted: 'The app is restarting on its current image.',
	in_flight: 'It applies when the running build deploys.',
	on_next_deploy: 'It applies the next time the app starts.',
};

function errorText(error: unknown) {
	return error instanceof Error ? error.message : 'Request failed';
}

function rowProblem(key: string, existing: Set<string>, others: string[]): string | null {
	if (!KEY_PATTERN.test(key)) return 'Use letters, digits and underscores; no leading digit.';
	if (RESERVED.some((pattern) => pattern.test(key))) return 'Reserved by Hangar.';
	if (existing.has(key)) return 'Already set. Use Change on the existing row.';
	if (others.filter((other) => other === key).length > 1) return 'Listed twice.';
	return null;
}

export function EnvPanel({ deploymentId }: { deploymentId: string }) {
	const [changing, setChanging] = useState<Record<string, string>>({});
	const [removed, setRemoved] = useState<Set<string>>(new Set());
	const [rows, setRows] = useState<NewRow[]>([]);
	const queryClient = useQueryClient();

	const { data, isLoading, isError } = useQuery({
		queryKey: ['env', deploymentId],
		queryFn: () => api.getEnvKeys(deploymentId),
	});

	const { data: attachments = [] } = useQuery({
		queryKey: ['attachments', deploymentId],
		queryFn: () => api.listAttachments(deploymentId),
	});

	const managed = new Map<string, string>();
	for (const a of attachments) for (const key of a.variables) managed.set(key, a.databaseCallsign);

	const keys = data?.keys ?? [];
	const existing = new Set(keys);
	const filled = rows.filter((row) => row.key.trim().length > 0);
	const newKeys = filled.map((row) => row.key.trim());
	const problems = filled.map((row) => rowProblem(row.key.trim(), existing, newKeys));
	const changedKeys = Object.keys(changing).filter((key) => changing[key].length > 0 && !removed.has(key));
	const changeCount = changedKeys.length + removed.size + filled.length;
	const invalid = problems.some(Boolean);

	const save = useMutation({
		mutationFn: () => {
			const set: Record<string, string> = {};
			for (const key of changedKeys) set[key] = changing[key];
			for (const row of filled) set[row.key.trim()] = row.value;
			return api.patchEnv(deploymentId, {
				...(Object.keys(set).length > 0 ? { set } : {}),
				...(removed.size > 0 ? { unset: [...removed] } : {}),
			});
		},
		onSuccess: (result) => {
			queryClient.setQueryData(['env', deploymentId], { keys: result.keys });
			queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
			queryClient.invalidateQueries({ queryKey: ['builds', deploymentId] });
			setChanging({});
			setRemoved(new Set());
			setRows([]);
			toast.success('Variables saved', { description: APPLY_COPY[result.apply] });
		},
	});

	function toggleRemoved(key: string) {
		setRemoved((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
		setChanging(({ [key]: _, ...rest }) => rest);
	}

	function updateRow(index: number, field: keyof NewRow, value: string) {
		setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
	}

	return (
		<>
			<h2 id="env-title" className="eyebrow mb-3">
				Environment
			</h2>

			{isError ? (
				<div className="panel border-alarm-400/30 px-5 py-5">
					<p className="font-code text-xs text-alarm-400">The variables couldn't be loaded.</p>
				</div>
			) : isLoading ? (
				<div className="h-24 animate-pulse rounded-xl bg-night-850" />
			) : (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						save.mutate();
					}}
					className="panel overflow-hidden"
				>
					{keys.length === 0 && rows.length === 0 ? (
						<p className="border-b border-dashed border-line px-5 py-5 text-sm text-steel-400">
							No variables set. Values are stored in Vault and injected at runtime.
						</p>
					) : (
						<ul className="divide-y divide-line">
							{keys.map((key) => {
								const owner = managed.get(key);
								const isRemoved = removed.has(key);
								const isChanging = key in changing;
								return (
									<li key={key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-5">
										<code
											className={cn(
												'min-w-0 flex-1 truncate font-code text-sm',
												isRemoved ? 'text-steel-500 line-through' : 'text-steel-100',
											)}
										>
											{key}
										</code>
										{owner ? (
											<span className="inline-flex items-center gap-1.5 font-code text-mono text-steel-500">
												<HugeiconsIcon icon={LockIcon} className="h-3 w-3" />
												managed by {owner}
											</span>
										) : isChanging ? (
											<Input
												type="text"
												aria-label={`New value for ${key}`}
												placeholder="new value"
												value={changing[key]}
												onChange={(e) => setChanging((current) => ({ ...current, [key]: e.target.value }))}
												autoComplete="off"
												spellCheck={false}
												autoFocus
												className="w-full font-code sm:w-72"
											/>
										) : (
											<span className="font-code text-mono tracking-widest text-steel-500">••••••••</span>
										)}
										{!owner && (
											<span className="flex items-center gap-1">
												{!isRemoved && (
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() =>
															setChanging((current) => {
																if (key in current) {
																	const { [key]: _, ...rest } = current;
																	return rest;
																}
																return { ...current, [key]: '' };
															})
														}
													>
														{isChanging ? 'Cancel' : 'Change'}
													</Button>
												)}
												<Button type="button" variant="ghost" size="sm" onClick={() => toggleRemoved(key)}>
													<HugeiconsIcon icon={isRemoved ? Undo02Icon : Cancel01Icon} />
													{isRemoved ? 'Undo' : 'Remove'}
												</Button>
											</span>
										)}
									</li>
								);
							})}
							{rows.map((row, i) => (
								<li key={`new-${i}`} className="px-4 py-3 md:px-5">
									<div className="flex gap-2">
										<Input
											type="text"
											aria-label={`New variable ${i + 1} name`}
											aria-invalid={problems[filled.indexOf(row)] ? true : undefined}
											placeholder="KEY"
											value={row.key}
											onChange={(e) => updateRow(i, 'key', e.target.value)}
											autoComplete="off"
											spellCheck={false}
											className="w-2/5 font-code uppercase placeholder:normal-case"
										/>
										<Input
											type="text"
											aria-label={`New variable ${i + 1} value`}
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
											onClick={() => setRows((current) => current.filter((_, j) => j !== i))}
											aria-label={`Remove new variable ${i + 1}`}
											className="size-11 rounded-lg border-input text-steel-500 not-disabled:hover:translate-y-0 hover:border-destructive/50 hover:bg-destructive/[0.06] hover:text-destructive"
										>
											<HugeiconsIcon icon={Cancel01Icon} />
										</Button>
									</div>
									{problems[filled.indexOf(row)] && (
										<p role="alert" className="mt-2 font-code text-mono text-destructive">
											{problems[filled.indexOf(row)]}
										</p>
									)}
								</li>
							))}
						</ul>
					)}

					<div className="flex flex-col gap-3 bg-night-850/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5">
						<div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setRows((current) => [...current, { key: '', value: '' }])}
								className="-ml-3 font-code text-mono tracking-[0.16em] text-deck-400 uppercase hover:bg-deck-400/[0.08] hover:text-deck-300"
							>
								<HugeiconsIcon icon={PlusSignIcon} />
								Add variable
							</Button>
							<p role="alert" className="min-w-0 font-code text-xs text-alarm-400">
								{save.isError && errorText(save.error)}
							</p>
						</div>
						<div className="flex items-center gap-3">
							{changeCount > 0 && (
								<span className="font-code text-mono tabular-nums text-steel-500">
									{changeCount} {changeCount === 1 ? 'change' : 'changes'}
								</span>
							)}
							<Button type="submit" variant="outline" size="sm" disabled={changeCount === 0 || invalid || save.isPending}>
								{save.isPending ? 'Saving…' : 'Save changes'}
							</Button>
						</div>
					</div>
				</form>
			)}
		</>
	);
}
