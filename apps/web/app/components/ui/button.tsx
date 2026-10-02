import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/utils';

const variants = cva(
	[
		'group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent font-semibold whitespace-nowrap outline-none select-none',
		'transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-settle',
		'not-disabled:hover:-translate-y-px not-disabled:active:translate-y-0',
		'focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
		'disabled:pointer-events-none disabled:opacity-45',
		'[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
	],
	{
		variants: {
			variant: {
				default: [
					'bg-primary text-primary-foreground hover:bg-deck-300',
					'shadow-[inset_0_0_0_1px_rgb(255_211_145/0.4),0_10px_40px_-10px_rgb(255_178_74/0.6)]',
				],
				outline:
					'border-steel-300/25 text-foreground hover:border-steel-300/50 hover:bg-white/[0.03] aria-expanded:bg-white/[0.03]',
				secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
				ghost: 'text-steel-300 hover:bg-muted hover:text-foreground aria-expanded:bg-muted',
				destructive: [
					'border-destructive/35 text-destructive hover:border-destructive/70 hover:bg-destructive/[0.08]',
					'focus-visible:ring-destructive/30',
				],
				danger: [
					'bg-alarm-500 text-white hover:bg-alarm-400',
					'shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12),0_10px_32px_-12px_rgb(229_72_77/0.7)]',
					'focus-visible:ring-destructive/40',
				],
				link: 'rounded-none text-primary underline-offset-4 hover:underline not-disabled:hover:translate-y-0',
			},
			size: {
				default: 'h-12 px-6 text-[15px]',
				sm: 'h-9 gap-1.5 px-4 text-[13px] [&_svg:not([class*=size-])]:size-3.5',
				lg: 'h-14 px-7 text-base',
				icon: 'size-12',
				'icon-sm': 'size-9 [&_svg:not([class*=size-])]:size-3.5',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

function buttonVariants({ className, ...props }: VariantProps<typeof variants> & { className?: string } = {}) {
	return cn(variants(props), className);
}

function Button({
	className,
	variant = 'default',
	size = 'default',
	...props
}: ButtonPrimitive.Props & VariantProps<typeof variants>) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={
				typeof className === 'function'
					? (state) => buttonVariants({ variant, size, className: className(state) })
					: buttonVariants({ variant, size, className })
			}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
