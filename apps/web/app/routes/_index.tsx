import { useEffect } from 'react';
import type { Route } from './+types/_index';
import '../story/story.css';
import { IntroGuard } from '../story/intro-guard';
import { jumpToAct } from '../story/motion';
import { StoryNav } from '../story/nav';
import { DeckAct } from '../story/acts/deck';
import { HangarAct } from '../story/acts/hangar';
import { CrewAct } from '../story/acts/crew';
import { LaunchAct } from '../story/acts/launch';
import { SquadronAct } from '../story/acts/squadron';
import { Coda, FleetAct } from '../story/acts/fleet';

export function meta({}: Route.MetaArgs) {
	return [
		{ title: 'Hangar · Your apps deserve a runway' },
		{
			name: 'description',
			content:
				'Hangar is a self-hosted platform built on Nomad, Consul, Vault and Caddy. Push a Git URL; it builds, schedules, routes and goes live.',
		},
	];
}

export default function Story() {
	useEffect(() => {
		const id = window.location.hash.slice(1);
		if (id && id !== 'main') requestAnimationFrame(() => jumpToAct(id));
	}, []);

	return (
		<div className="story">
			<IntroGuard />
			<a href="#main" className="skip-link">
				Skip to content
			</a>
			<StoryNav />
			<main id="main">
				<DeckAct />
				<HangarAct />
				<CrewAct />
				<LaunchAct />
				<SquadronAct />
				<FleetAct />
				<Coda />
			</main>
		</div>
	);
}
