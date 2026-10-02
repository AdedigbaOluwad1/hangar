// apps/web/app/components/copy-button.tsx
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Copy01Icon, Tick01Icon } from '@hugeicons/core-free-icons';

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// clipboard API unavailable — no-op
		}
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			aria-label={label}
			title={label}
			className="inline-flex items-center justify-center rounded-md p-1.5 text-steel-500 transition-colors hover:bg-night-800 hover:text-steel-100"
		>
			{copied ? (
				<HugeiconsIcon icon={Tick01Icon} className="h-3.5 w-3.5 text-signal-400" />
			) : (
				<HugeiconsIcon icon={Copy01Icon} className="h-3.5 w-3.5" />
			)}
		</button>
	);
}
