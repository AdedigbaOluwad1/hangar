import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { HistoryIcon, RefreshIcon, SquareStopIcon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { shortId } from '../lib/format';
import { Button } from './ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from './ui/select';
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

export function DeploymentActions({
	deploymentId,
	currentImageTag,
	status,
}: {
	deploymentId: string;
	currentImageTag: string | null;
	status: string;
}) {
	const [rollbackTag, setRollbackTag] = useState<string | null>(null);
	const [confirmStop, setConfirmStop] = useState(false);
	const queryClient = useQueryClient();

	const { data: tagsData } = useQuery({
		queryKey: ['tags', deploymentId],
		queryFn: () => api.getTags(deploymentId),
	});

	function invalidate() {
		queryClient.invalidateQueries({ queryKey: ['deployment', deploymentId] });
		queryClient.invalidateQueries({ queryKey: ['builds', deploymentId] });
		queryClient.invalidateQueries({ queryKey: ['deployments'] });
	}

	const redeploy = useMutation({
		mutationFn: () => api.redeploy(deploymentId),
		onSuccess: () => {
			invalidate();
			toast.success('Redeploy queued', { description: 'Fresh clone, rebuilt on cached layers.' });
		},
		onError: (error) => toast.error("Couldn't redeploy", { description: errorText(error) }),
	});

	const rollback = useMutation({
		mutationFn: (tag: string) => api.rollback(deploymentId, tag),
		onSuccess: (_, tag) => {
			invalidate();
			setRollbackTag(null);
			toast.success('Rolling back', { description: `Image :${shortId(tag, 13)}, no rebuild.` });
		},
		onError: (error) => toast.error("Couldn't roll back", { description: errorText(error) }),
	});

	const stop = useMutation({
		mutationFn: () => api.deleteDeployment(deploymentId),
		onSuccess: () => {
			invalidate();
			toast.success('Stood down', { description: 'Nomad job stopped and Caddy route removed.' });
		},
		onError: (error) => toast.error("Couldn't stop", { description: errorText(error) }),
	});

	const currentTag = currentImageTag?.split(':').pop() ?? null;
	const tags = (tagsData?.tags ?? []).map((tag) => ({
		value: tag,
		label: `:${shortId(tag, 13)}`,
		current: tag === currentTag,
	}));
	const canRollBack = tags.some((t) => !t.current);

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button variant="outline" size="sm" onClick={() => redeploy.mutate()} disabled={redeploy.isPending}>
				<HugeiconsIcon icon={RefreshIcon} className={redeploy.isPending ? 'animate-spin' : undefined} />
				Redeploy
			</Button>

			{canRollBack && (
				<div className="flex items-center gap-2">
					<Select items={tags} value={rollbackTag} onValueChange={(value) => setRollbackTag(value)}>
						<SelectTrigger size="sm" aria-label="Image to roll back to" className="w-48 rounded-full font-code text-xs">
							<HugeiconsIcon icon={HistoryIcon} className="size-3.5 text-steel-500" />
							<SelectValue placeholder="Roll back to…" />
						</SelectTrigger>
						<SelectContent align="end" alignItemWithTrigger={false}>
							<SelectGroup>
								<SelectLabel>Last 3 images</SelectLabel>
								{tags.map((t) => (
									<SelectItem key={t.value} value={t.value} disabled={t.current} className="font-code text-xs">
										{t.label}
										{t.current && <span className="ml-auto text-[10px] text-steel-500">live</span>}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<Button
						variant="outline"
						size="sm"
						onClick={() => rollbackTag && rollback.mutate(rollbackTag)}
						disabled={!rollbackTag || rollback.isPending}
					>
						{rollback.isPending ? 'Rolling back…' : 'Roll back'}
					</Button>
				</div>
			)}

			<AlertDialog open={confirmStop} onOpenChange={setConfirmStop}>
				<AlertDialogTrigger
					render={<Button variant="destructive" size="sm" disabled={stop.isPending || status === 'stopped'} />}
				>
					<HugeiconsIcon icon={SquareStopIcon} />
					{stop.isPending ? 'Stopping…' : 'Stop'}
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia>
							<HugeiconsIcon icon={SquareStopIcon} className="size-5" />
						</AlertDialogMedia>
						<AlertDialogTitle>Stand this one down?</AlertDialogTitle>
						<AlertDialogDescription>
							Hangar stops the Nomad job and removes its Caddy route, so the live URL goes dark. The deployment and its
							build history stay; you can redeploy it later.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep it flying</AlertDialogCancel>
						<AlertDialogAction
							variant="danger"
							size="sm"
							onClick={() => {
								setConfirmStop(false);
								stop.mutate();
							}}
						>
							Stop deployment
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
