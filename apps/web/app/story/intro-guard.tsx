export const INTRO_GUARD_ID = 'story-intro-guard';

const script = `(function(){if(!matchMedia('(prefers-reduced-motion: no-preference)').matches)return;var s=document.createElement('style');s.id='${INTRO_GUARD_ID}';s.textContent='.story [data-intro]{visibility:hidden}';document.head.appendChild(s);setTimeout(function(){s.remove()},3000)})()`;

export function IntroGuard() {
	return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function releaseIntroGuard() {
	document.getElementById(INTRO_GUARD_ID)?.remove();
}
