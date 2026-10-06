import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, DatabaseIcon, PlusSignIcon, UnlinkIcon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { ENGINES, type DeploymentAttachment } from '@hangar/types';
import { api } from '../lib/api';
import { paths } from '../lib/paths';
import { ACTIVE_ATTACHMENT_STATUSES } from '../lib/status';
import { StatusBadge } from './status-badge';
import { Button, buttonVariants } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from './ui/alert-dialog';

function errorText(error: unknown) {
	return error instanceof Error ? error.message : 'Request failed';
}

export function DataPanel({ deploymentId }: { deploymentId: string }) {
	const [adding, setAdding] = useState(false);
	const [databaseId, setDatabaseId] = useState<string | null>(null);
	const [envName, setEnvName] = useState('');
	const [detaching, setDetaching] = useState<DeploymentAttachment | null>(null);
	const queryClient = useQueryClient();

	const { data: attachments = [], isLoading } = useQuery({
		queryKey: ['attachments', deploymentId],
		queryFn: () => api.listAttachments(deploymentId),
		refetchInterval: (query) =>
			query.state.data?.some((a) => ACTIVE_ATTACHMENT_STATUSES.includes(a.status)) ? 2000 : 10000,
	});

	const { data: databases = [] } = useQuery({
		queryKey: ['databases'],
		queryFn: api.listDatabases,
		enabled: adding,
	});

	function invalidate() {
		queryClient.invalidateQueries({ queryKey: ['attachments', deploymentId] });
		queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
		queryClient.invalidateQueries({ queryKey: ['builds', deploymentId] });
		queryClient.invalidateQueries({ queryKey: ['databases'] });
		queryClient.invalidateQueries({ queryKey: ['database'] });
	}

	const attach = useMutation({
		mutationFn: () => api.attachDatabase(deploymentId, { databaseId: databaseId!, envName: envName.trim() || undefined }),
		onSuccess: () => {
			invalidate();
			setAdding(false);
			setDatabaseId(null);
			setEnvName('');
			toast.success('Attaching', {
				description: 'The connection variables are added. A running app restarts on its current image.',
			});
		},
	});

	const detach = useMutation({
		mutationFn: (attachmentId: string) => api.detachDatabase(deploymentId, attachmentId),
		onSuccess: () => {
			invalidate();
			setDetaching(null);
			toast.success('Detaching', { description: 'The variables are removed and the role is dropped.' });
		},
		onError: (error) => toast.error("Couldn't detach", { description: errorText(error) }),
	});

	const attachedIds = new Set(attachments.map((a) => a.databaseId));
	const choices = databases.filter((d) => d.status === 'ready' && !attachedIds.has(d.id));
	const items = choices.map((d) => ({ value: d.id, label: `${d.callsign} · ${ENGINES[d.engine].label} ${d.version}` }));

	return (
		<>
			<div className="mb-3 flex items-center justify-between gap-4">
				<h2 id="data-title" className="eyebrow">
					Data
				</h2>
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						attach.reset();
						setAdding(true);
					}}
				>
					<HugeiconsIcon icon={PlusSignIcon} />
					Add database
				</Button>
			</div>

			{isLoading ? (
				<div className="h-20 animate-pulse rounded-xl bg-night-850" />
			) : attachments.length === 0 ? (
				<div className="panel flex items-center gap-4 border-dashed px-5 py-5">
					<HugeiconsIcon icon={DatabaseIcon} className="h-5 w-5 shrink-0 text-steel-500" />
					<p className="text-sm text-steel-400">No database attached. Attaching one adds its connection variables to this app.</p>
				</div>
			) : (
				<ul className="panel divide-y divide-line overflow-hidden">
					{attachments.map((a) => (
						<li
							key={a.id}
							className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 transition-colors duration-quick ease-settle hover:bg-night-850 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:px-5"
						>
							<div className="min-w-0">
								<Link
									to={paths.database(a.databaseId)}
									className="block truncate font-medium text-steel-100 after:absolute after:inset-0"
								>
									{a.databaseCallsign}
								</Link>
								<p className="mt-0.5 truncate font-code text-mono text-steel-500">
									{a.envName}
									{a.variables.length > 1 && ` +${a.variables.length - 1}`} · managed by {a.databaseCallsign}
								</p>
							</div>
							<StatusBadge status={a.status} />
							<span className="relative z-10 hidden md:block">
								<Button
									variant="outline"
									size="sm"
									disabled={ACTIVE_ATTACHMENT_STATUSES.includes(a.status)}
									onClick={() => setDetaching(a)}
								>
									<HugeiconsIcon icon={UnlinkIcon} />
									Detach
								</Button>
							</span>
							<HugeiconsIcon
								icon={ArrowRight01Icon}
								className="hidden h-4 w-4 text-steel-500 transition-transform duration-quick ease-settle group-hover:translate-x-1 group-hover:text-steel-100 md:block"
							/>
						</li>
					))}
				</ul>
			)}

			<AlertDialog open={adding} onOpenChange={setAdding}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia>
							<HugeiconsIcon icon={DatabaseIcon} className="size-5" />
						</AlertDialogMedia>
						<AlertDialogTitle>Attach a database</AlertDialogTitle>
						<AlertDialogDescription>
							Hangar creates a role limited to this app and adds its connection variables. A running app restarts on its
							current image.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{choices.length === 0 ? (
						<p className="px-1 text-sm text-steel-400">
							No ready database to attach.{' '}
							<Link to={paths.newDatabase} className="text-deck-300 hover:text-deck-400">
								Create one
							</Link>
							.
						</p>
					) : (
						<div className="space-y-4 px-1">
							<div>
								<Label htmlFor="attach-database" className="mb-2.5">
									Database
								</Label>
								<Select items={items} value={databaseId} onValueChange={(value) => setDatabaseId(value as string)}>
									<SelectTrigger id="attach-database" className="w-full">
										<SelectValue placeholder="Choose a database" />
									</SelectTrigger>
									<SelectContent>
										{items.map((item) => (
											<SelectItem key={item.value} value={item.value}>
												{item.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div>
								<Label htmlFor="attach-env" className="mb-2.5">
									Variable name
								</Label>
								<Input
									id="attach-env"
									value={envName}
									onChange={(e) => setEnvName(e.target.value.toUpperCase())}
									placeholder="DATABASE_URL"
									autoComplete="off"
									spellCheck={false}
									className="font-code"
								/>
							</div>
							<p role="alert" className="min-h-4 font-code text-mono text-alarm-400">
								{attach.isError && errorText(attach.error)}
							</p>
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							size="sm"
							disabled={!databaseId || attach.isPending}
							onClick={(e) => {
								e.preventDefault();
								attach.mutate();
							}}
						>
							{attach.isPending ? 'Attaching…' : 'Attach'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={detaching !== null} onOpenChange={(open) => !open && setDetaching(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia>
							<HugeiconsIcon icon={UnlinkIcon} className="size-5" />
						</AlertDialogMedia>
						<AlertDialogTitle>Detach {detaching?.databaseCallsign}?</AlertDialogTitle>
						<AlertDialogDescription>
							Hangar removes {detaching?.variables.length ?? 0} variables from this app, drops its role in the database
							and restarts a running app. The database and its data stay.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep it attached</AlertDialogCancel>
						<AlertDialogAction
							variant="danger"
							size="sm"
							disabled={detach.isPending}
							onClick={() => detaching && detach.mutate(detaching.id)}
						>
							{detach.isPending ? 'Detaching…' : 'Detach'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
