import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import {
	CheckmarkCircle02Icon,
	InformationCircleIcon,
	Alert02Icon,
	MultiplicationSignCircleIcon,
	Loading03Icon,
} from '@hugeicons/core-free-icons';

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			theme="dark"
			position="bottom-right"
			className="toaster group"
			icons={{
				success: <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-signal-400" />,
				info: <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-4 text-steel-300" />,
				warning: <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4 text-deck-400" />,
				error: <HugeiconsIcon icon={MultiplicationSignCircleIcon} strokeWidth={2} className="size-4 text-alarm-400" />,
				loading: <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-4 animate-spin text-deck-400" />,
			}}
			style={
				{
					'--normal-bg': 'var(--popover)',
					'--normal-text': 'var(--popover-foreground)',
					'--normal-border': 'var(--border)',
					'--border-radius': '0.875rem',
				} as React.CSSProperties
			}
			toastOptions={{
				classNames: {
					toast: 'font-text shadow-[0_24px_60px_-12px_rgb(0_0_0/0.85)]!',
					title: 'font-medium text-steel-100',
					description: 'font-code text-[11px]! text-steel-400!',
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
