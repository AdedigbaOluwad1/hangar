import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import {
	DATABASE_PLANS,
	DATABASE_PLAN_KEYS,
	ENGINES,
	type DatabaseEngine,
	type DatabasePlan,
} from '@hangar/types';
import { api } from '../lib/api';
import { paths } from '../lib/paths';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const ENGINE_KEYS = Object.keys(ENGINES) as DatabaseEngine[];

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

export function DatabaseForm() {
	const [engine, setEngine] = useState<DatabaseEngine>('postgres');
	const [version, setVersion] = useState(ENGINES.postgres.defaultVersion);
	const [plan, setPlan] = useState<DatabasePlan>('small');
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const spec = ENGINES[engine];
	const chosen = DATABASE_PLANS[plan];

	const mutation = useMutation({
		mutationFn: () => api.createDatabase({ engine, version, plan }),
		onSuccess: (database) => {
			queryClient.invalidateQueries({ queryKey: ['databases'] });
			toast.success(`${database.callsign} is on the pad`, {
				description: `${spec.label} ${database.version}, ${chosen.label} plan.`,
			});
			navigate(paths.database(database.id));
		},
	});

	const engineItems = ENGINE_KEYS.map((key) => ({ value: key, label: ENGINES[key].label }));
	const versionItems = spec.versions.map((v) => ({ value: v, label: v }));
	const planItems = DATABASE_PLAN_KEYS.map((key) => ({
		value: key,
		label: `${DATABASE_PLANS[key].label} · ${DATABASE_PLANS[key].storageGb} GB`,
	}));

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				mutation.mutate();
			}}
			className="panel overflow-hidden"
		>
			<Section n="01" title="Engine" description="What runs inside the database.">
				<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
					<div>
						<Label htmlFor="engine" className="mb-2.5">
							Engine
						</Label>
						<Select
							items={engineItems}
							value={engine}
							onValueChange={(value) => {
								const next = value as DatabaseEngine;
								setEngine(next);
								setVersion(ENGINES[next].defaultVersion);
							}}
						>
							<SelectTrigger id="engine" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{engineItems.map((item) => (
									<SelectItem key={item.value} value={item.value} disabled={!ENGINES[item.value].available}>
										{item.label}
										{!ENGINES[item.value].available && <span className="chip chip-coming ml-auto">Coming</span>}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label htmlFor="version" className="mb-2.5">
							Version
						</Label>
						<Select items={versionItems} value={version} onValueChange={(value) => setVersion(value as string)}>
							<SelectTrigger id="version" className="w-full font-code">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{versionItems.map((item) => (
									<SelectItem key={item.value} value={item.value} className="font-code">
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</Section>

			<Section n="02" title="Plan" description="CPU, memory and storage are fixed per plan.">
				<Label htmlFor="plan" className="mb-2.5">
					Plan
				</Label>
				<Select items={planItems} value={plan} onValueChange={(value) => setPlan(value as DatabasePlan)}>
					<SelectTrigger id="plan" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{planItems.map((item) => (
							<SelectItem
								key={item.value}
								value={item.value}
								disabled={DATABASE_PLAN_KEYS.indexOf(item.value) < DATABASE_PLAN_KEYS.indexOf(spec.minPlan)}
							>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<p className="mt-2 font-code text-mono tabular-nums text-steel-500">
					<span className="text-deck-400">›</span> {chosen.cpu} MHz · {chosen.memoryMb} MB · {chosen.storageGb} GB ·{' '}
					{chosen.backupRetentionDays} days of backups
				</p>
			</Section>

			<div className="flex flex-col-reverse gap-4 border-t border-line bg-night-850/60 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
				<p role="alert" className="font-code text-xs text-alarm-400">
					{mutation.isError &&
						(mutation.error instanceof Error ? mutation.error.message : 'Failed to create database')}
				</p>
				<Button type="submit" disabled={!spec.available || mutation.isPending}>
					{mutation.isPending ? (
						<>
							<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-night-950/30 border-t-night-950" />
							Creating…
						</>
					) : (
						<>
							Create
							<HugeiconsIcon icon={ArrowRight01Icon} />
						</>
					)}
				</Button>
			</div>
		</form>
	);
}
