import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { PencilEdit02Icon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';
import type { Deployment } from '@hangar/types';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';

const CALLSIGN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function problemWith(value: string) {
	if (value.length < 3) return 'At least 3 characters';
	if (value.length > 40) return 'At most 40 characters';
	if (!CALLSIGN.test(value)) return 'Lowercase letters, numbers and single hyphens';
	return null;
}

export function CallsignTitle({ deployment }: { deployment: Deployment }) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(deployment.callsign);
	const [touched, setTouched] = useState(false);
	const input = useRef<HTMLInputElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	const queryClient = useQueryClient();

	const rename = useMutation({
		mutationFn: (callsign: string) => api.renameDeployment(deployment.id, callsign),
		onSuccess: (renamed) => {
			queryClient.setQueryData(['deployment', deployment.id], renamed);
			queryClient.invalidateQueries({ queryKey: ['deployments'] });
			toast.success(`Now flying as ${renamed.callsign}`);
			close();
		},
	});

	useEffect(() => {
		if (editing) input.current?.select();
	}, [editing]);

	function open() {
		setDraft(deployment.callsign);
		setTouched(false);
		rename.reset();
		setEditing(true);
	}

	function close() {
		setEditing(false);
		requestAnimationFrame(() => trigger.current?.focus());
	}

	const value = draft.trim().toLowerCase();
	const local = touched ? problemWith(value) : null;
	const error = local ?? (rename.error instanceof Error ? rename.error.message : null);

	if (!editing) {
		return (
			<div className="group/title flex min-w-0 items-center gap-3">
				<h1 className="display truncate text-5xl md:text-7xl">{deployment.callsign}</h1>
				<Button
					ref={trigger}
					variant="ghost"
					size="icon-sm"
					onClick={open}
					aria-label="Rename callsign"
					className="shrink-0 text-steel-500 opacity-60 group-hover/title:opacity-100 focus-visible:opacity-100"
				>
					<HugeiconsIcon icon={PencilEdit02Icon} />
				</Button>
			</div>
		);
	}

	return (
		<form
			className="max-w-xl"
			onSubmit={(e) => {
				e.preventDefault();
				setTouched(true);
				if (problemWith(value)) return;
				if (value === deployment.callsign) return close();
				rename.mutate(value);
			}}
		>
			<h1 className="sr-only">{deployment.callsign}</h1>
			<label htmlFor="callsign" className="sr-only">
				Callsign
			</label>
			<div className="flex items-center gap-2">
				<Input
					ref={input}
					id="callsign"
					value={draft}
					onChange={(e) => {
						setDraft(e.target.value);
						if (rename.isError) rename.reset();
					}}
					onBlur={() => setTouched(true)}
					onKeyDown={(e) => {
						if (e.key === 'Escape') {
							e.preventDefault();
							close();
						}
					}}
					aria-invalid={error ? true : undefined}
					aria-describedby="callsign-hint"
					autoComplete="off"
					spellCheck={false}
					maxLength={40}
					className="h-14 font-display text-3xl font-bold tracking-wide uppercase md:h-16 md:text-4xl"
				/>
				<Button type="submit" size="sm" disabled={rename.isPending}>
					{rename.isPending ? 'Saving…' : 'Save'}
				</Button>
				<Button type="button" variant="ghost" size="sm" onClick={close}>
					Cancel
				</Button>
			</div>
			<p
				id="callsign-hint"
				role={error ? 'alert' : undefined}
				className={`mt-2 font-code text-[11px] ${error ? 'text-destructive' : 'text-steel-500'}`}
			>
				{error ?? 'Lowercase letters, numbers and hyphens. Enter to save, Esc to cancel.'}
			</p>
		</form>
	);
}
