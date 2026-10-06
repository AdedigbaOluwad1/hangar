import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Archive02Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { paths } from '../lib/paths';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
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
	AlertDialogTrigger,
} from './ui/alert-dialog';

function errorText(error: unknown) {
	return error instanceof Error ? error.message : 'Request failed';
}

export function DatabaseActions({
	databaseId,
	callsign,
	status,
	backingUp,
}: {
	databaseId: string;
	callsign: string;
	status: string;
	backingUp: boolean;
}) {
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [typed, setTyped] = useState('');
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	function invalidate() {
		queryClient.invalidateQueries({ queryKey: ['database', databaseId] });
		queryClient.invalidateQueries({ queryKey: ['backups', databaseId] });
		queryClient.invalidateQueries({ queryKey: ['databases'] });
	}

	const backUp = useMutation({
		mutationFn: () => api.backUpNow(databaseId),
		onSuccess: () => {
			invalidate();
			toast.success('Backup started', { description: 'A base backup is being written to the archive.' });
		},
		onError: (error) => toast.error("Couldn't start a backup", { description: errorText(error) }),
	});

	const remove = useMutation({
		mutationFn: () => api.deleteDatabase(databaseId),
		onSuccess: () => {
			invalidate();
			toast.success('Stood down', { description: 'The instance is stopping and its data directory is being removed.' });
			navigate(paths.databases);
		},
		onError: (error) => toast.error("Couldn't delete", { description: errorText(error) }),
	});

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onClick={() => backUp.mutate()}
				disabled={backUp.isPending || backingUp || status !== 'ready'}
			>
				<HugeiconsIcon icon={Archive02Icon} className={backUp.isPending ? 'animate-pulse' : undefined} />
				{backUp.isPending ? 'Starting…' : 'Back up now'}
			</Button>

			<AlertDialog
				open={confirmDelete}
				onOpenChange={(open) => {
					setConfirmDelete(open);
					if (!open) setTyped('');
				}}
			>
				<AlertDialogTrigger
					render={
						<Button
							variant="destructive"
							size="sm"
							disabled={remove.isPending || status === 'deleting' || status === 'provisioning'}
						/>
					}
				>
					<HugeiconsIcon icon={Delete02Icon} />
					{remove.isPending ? 'Deleting…' : 'Delete'}
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia>
							<HugeiconsIcon icon={Delete02Icon} className="size-5" />
						</AlertDialogMedia>
						<AlertDialogTitle>Scrap this database?</AlertDialogTitle>
						<AlertDialogDescription>
							Hangar stops the instance and removes its data directory. Backups stay in the archive. Detach it from
							every app first.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="px-1">
						<Label htmlFor="confirm-callsign" className="mb-2.5">
							Type {callsign} to confirm
						</Label>
						<Input
							id="confirm-callsign"
							value={typed}
							onChange={(e) => setTyped(e.target.value)}
							autoComplete="off"
							spellCheck={false}
							className="font-code"
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep it</AlertDialogCancel>
						<AlertDialogAction
							variant="danger"
							size="sm"
							disabled={typed !== callsign}
							onClick={() => {
								setConfirmDelete(false);
								setTyped('');
								remove.mutate();
							}}
						>
							Delete database
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
