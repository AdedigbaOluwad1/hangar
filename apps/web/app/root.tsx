import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, type LinksFunction } from 'react-router';
import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './app.css';
import { Toaster } from './components/ui/sonner';

export const links: LinksFunction = () => [
	{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
	{ rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
	{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
	{ rel: 'manifest', href: '/site.webmanifest' },
];

export default function App() {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: { staleTime: 5000, refetchOnWindowFocus: false },
				},
			}),
	);

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
