import { createCn } from 'cn/config';

export const cn = createCn({
	extend: {
		classGroups: {
			'font-size': [
				{ text: ['display-hero', 'display-act', 'display-finale', 'stencil', 'micro', 'mono', 'button', 'button-sm'] },
			],
			duration: [{ duration: ['impact', 'instant', 'quick', 'base', 'slow', 'epic'] }],
			ease: [{ ease: ['throttle', 'settle', 'glide', 'snap', 'brake', 'spool'] }],
		},
	},
});
