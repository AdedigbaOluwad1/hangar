import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLocation,
	useNavigate,
	type LinksFunction,
} from 'react-router';
import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './app.css';
import { Toaster } from './components/ui/sonner';
import { UnauthorizedError } from './lib/api';
import { paths } from './lib/paths';

export const links: LinksFunction = () => [
	{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
	{ rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
	{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
	{ rel: 'manifest', href: '/site.webmanifest' },
];

export default function App() {
	const navigate = useNavigate();
	const location = useLocation();
	const redirect = useRef<() => void>(() => {});
	redirect.current = () => {
		if (location.pathname === paths.signIn) return;
		const here = location.pathname + location.search;
		navigate(`${paths.signIn}?next=${encodeURIComponent(here)}`, { replace: true });
	};

	const [queryClient] = useState(() => {
		const onError = (error: Error) => {
			if (error instanceof UnauthorizedError) redirect.current();
		};
		return new QueryClient({
			queryCache: new QueryCache({ onError }),
			mutationCache: new MutationCache({ onError }),
			defaultOptions: {
				queries: {
					staleTime: 5000,
					refetchOnWindowFocus: false,
					retry: (count, error) => !(error instanceof UnauthorizedError) && count < 3,
				},
			},
		});
	});

	return (
		<html lang="en" className="dark">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="theme-color" content="#03050a" /> {/* tokens-ok: browsers read this before CSS loads */}
				<Meta />
				<Links />
			</head>
			<body>
				<div className="grain" aria-hidden="true" />
				<QueryClientProvider client={queryClient}>
					<Outlet />
				</QueryClientProvider>
				<Toaster />
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
