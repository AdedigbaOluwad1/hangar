import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import type { Route } from './+types/sign-in';
import { api, UnauthorizedError } from '../lib/api';
import { paths } from '../lib/paths';
import { useReveal } from '../lib/motion';
import { Header } from '../components/header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function meta({}: Route.MetaArgs) {
	return [{ title: 'Sign in · Hangar' }];
}

function destination(next: string | null): string {
	return next && next.startsWith(paths.dashboard) ? next : paths.dashboard;
}

export default function SignIn() {
	const scope = useRef<HTMLDivElement>(null);
	const [token, setToken] = useState('');
	const [params] = useSearchParams();
	const navigate = useNavigate();
	const to = destination(params.get('next'));
	useReveal(scope, true);

	const session = useQuery({ queryKey: ['session'], queryFn: api.getSession, retry: false });
	useEffect(() => {
		if (session.data) navigate(to, { replace: true });
	}, [session.data, navigate, to]);

	const mutation = useMutation({
		mutationFn: () => api.signIn(token),
		onSuccess: () => navigate(to, { replace: true }),
	});

	const error = mutation.error
		? mutation.error instanceof UnauthorizedError
			? "That token isn't valid."
			: mutation.error.message
		: null;

	return (
		<div ref={scope} className="relative min-h-screen">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]"
			>
				<div className="blueprint-grid absolute inset-0 opacity-60" />
				<div className="absolute -top-40 left-1/2 h-80 w-[60%] -translate-x-1/2 rounded-full bg-deck-400/10 blur-3xl" />
			</div>

			<Header bare />

			<main className="relative mx-auto max-w-md px-5 pb-20 pt-12 md:pt-20">
				<p data-reveal className="eyebrow">
					Clearance
				</p>
				<h1 data-reveal className="display mt-4 text-6xl md:text-7xl">
					Sign in
				</h1>
				<p data-reveal className="mt-5 text-sm leading-relaxed text-steel-400">
					Hangar uses one shared admin token for now. It lives in Vault at <span className="font-code">hangar/config</span>.
				</p>

				<form
					data-reveal
					onSubmit={(e) => {
						e.preventDefault();
						mutation.mutate();
					}}
					className="panel mt-10 overflow-hidden"
				>
					<div className="px-5 py-7 md:px-7">
						<Label htmlFor="admin-token" className="mb-2.5">
							Admin token
						</Label>
						<Input
							id="admin-token"
							type="password"
							required
							autoFocus
							autoComplete="off"
							spellCheck={false}
							aria-invalid={mutation.isError}
							value={token}
							onChange={(e) => setToken(e.target.value)}
							className="font-code"
						/>
					</div>

					<div className="flex flex-col-reverse gap-4 border-t border-line bg-night-850/60 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
						<p role="alert" className="font-code text-xs text-alarm-400">
							{error}
						</p>
						<Button type="submit" disabled={!token || mutation.isPending}>
							{mutation.isPending ? (
								<>
									<span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-night-950/30 border-t-night-950" />
									Signing in…
								</>
							) : (
								<>
									Sign in
									<HugeiconsIcon icon={ArrowRight01Icon} />
								</>
							)}
						</Button>
					</div>
				</form>
			</main>
		</div>
	);
}
