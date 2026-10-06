import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Archive02Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import type { DatabaseBackup } from '@hangar/types';
import { api } from '../lib/api';
import { paths } from '../lib/paths';
import { formatBytes, formatRelativeTime } from '../lib/format';
import { backupStatus } from '../lib/status';
import { StatusBadge } from './status-badge';
import { Button } from './ui/button';
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

const KIND_LABEL = { scheduled: 'Nightly', manual: 'Manual', final: 'Final' } as const;

export function BackupList({
	databaseId,
	backups,
	canRestore,
}: {
	databaseId: string;
	backups: DatabaseBackup[];
	canRestore: boolean;
}) {
	const [restoring, setRestoring] = useState<DatabaseBackup | null>(null);
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const restore = useMutation({
		mutationFn: (backupId: string) => api.restoreDatabase(databaseId, backupId),
		onSuccess: (database) => {
			queryClient.invalidateQueries({ queryKey: ['databases'] });
			toast.success(`${database.callsign} is on the pad`, {
				description: 'A new database is being restored from the backup.',
			});
			setRestoring(null);
			navigate(paths.database(database.id));
		},
		onError: (error) =>
			toast.error("Couldn't restore", { description: error instanceof Error ? error.message : 'Request failed' }),
	});

	if (backups.length === 0) {
		return (
			<div className="panel flex items-center gap-4 border-dashed px-5 py-5">
				<HugeiconsIcon icon={Archive02Icon} className="h-5 w-5 shrink-0 text-steel-500" />
				<p className="text-sm text-steel-400">No backups yet. The first one starts once the database is ready.</p>
			</div>
		);
	}

	return (
		<>
			<ul className="panel divide-y divide-line overflow-hidden">
				{backups.map((b) => (
					<li
						key={b.id}
						className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:px-5"
					>
						<div className="min-w-0">
							<p className="truncate text-sm text-steel-100">
								{KIND_LABEL[b.kind]}
								<span className="ml-2 font-code text-mono text-steel-500">{formatRelativeTime(b.startedAt)}</span>
							</p>
							{b.error && <p className="mt-0.5 truncate font-code text-mono text-alarm-400">{b.error}</p>}
						</div>
						<StatusBadge status={backupStatus(b)} />
						<span className="hidden font-code text-mono tabular-nums text-steel-400 md:block">
							{formatBytes(b.sizeBytes)}
						</span>
						<span className="hidden md:block">
							{b.status === 'completed' && (
								<Button variant="outline" size="sm" disabled={!canRestore} onClick={() => setRestoring(b)}>
									<HugeiconsIcon icon={RefreshIcon} />
									Restore
								</Button>
							)}
						</span>
					</li>
				))}
			</ul>

			<AlertDialog open={restoring !== null} onOpenChange={(open) => !open && setRestoring(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia>
							<HugeiconsIcon icon={RefreshIcon} className="size-5" />
						</AlertDialogMedia>
						<AlertDialogTitle>Restore into a new database?</AlertDialogTitle>
						<AlertDialogDescription>
							Hangar creates a separate database from this backup, as it stood when the backup finished. The original is
							not touched and no apps are attached to the copy.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							size="sm"
							disabled={restore.isPending}
							onClick={() => restoring && restore.mutate(restoring.id)}
						>
							{restore.isPending ? 'Restoring…' : 'Restore'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
