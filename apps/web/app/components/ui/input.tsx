import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from '~/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cn(
				'h-11 w-full min-w-0 rounded-[10px] border border-input bg-card px-3.5 text-sm text-foreground caret-deck-400 outline-none',
				'transition-[border-color,box-shadow,background-color] duration-200 ease-settle',
				'placeholder:text-steel-500',
				'hover:border-steel-500/60',
				'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20',
				'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
				'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50',
				'autofill:shadow-[inset_0_0_0_1000px_var(--color-night-900)] autofill:[-webkit-text-fill-color:var(--color-steel-100)]',
				'[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
				'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
