// apps/web/app/components/mark.tsx
export function Mark({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
			<rect width="32" height="32" rx="8" fill="#ffb24a" />
			<path
				d="M16 5 L18.2 12 L26 19 L26 21.5 L18.4 19 L18 24 L21 26.5 L21 27.5 L16 26.5 L11 27.5 L11 26.5 L14 24 L13.6 19 L6 21.5 L6 19 L13.8 12 Z"
				fill="#03050a"
			/>
		</svg>
	);
}
