import { PIPELINE_LOG } from '@hangar/types';

export const DEPLOYMENT_ID = 'dep-k7m2x9qa';
export const BUILD_ID = '0199a3f4-1b7a-7c2e-8f03-a46d92e1c5b8';
const EVAL_ID = 'b1c4e8a2-73f9-4d61-a0e5-2f8c6d9b3e17';

export const SHORT_ID = DEPLOYMENT_ID;
export const REGISTRY_REPO = `registry.service.consul:5000/hangar-${DEPLOYMENT_ID}`;
export const VERSIONED_TAG = `${REGISTRY_REPO}:${BUILD_ID}`;
export const LIVE_URL = `http://${DEPLOYMENT_ID}.localhost`;

export const REGISTRY_TAGS = [
	{ tag: BUILD_ID.slice(0, 13) + '…', note: 'this build' },
	{ tag: 'latest', note: 'current' },
	{ tag: 'cache', note: 'BuildKit layers' },
];

export type LogStage = 'system' | 'build' | 'deploy';

export const LOG_LINES: Array<{ stage: LogStage; text: string }> = [
	{ stage: 'system', text: `${PIPELINE_LOG.clone} /tmp/hangar-${DEPLOYMENT_ID}-k2P9xq` },
	{ stage: 'build', text: `${PIPELINE_LOG.detect}...` },
	{ stage: 'build', text: `${PIPELINE_LOG.build} ${VERSIONED_TAG}` },
	{ stage: 'build', text: `${PIPELINE_LOG.push}: ${VERSIONED_TAG}` },
	{ stage: 'deploy', text: PIPELINE_LOG.schedule },
	{ stage: 'deploy', text: `${PIPELINE_LOG.scheduled}: ${EVAL_ID}` },
	{ stage: 'deploy', text: PIPELINE_LOG.route },
	{ stage: 'deploy', text: `${PIPELINE_LOG.live} ${LIVE_URL}` },
	{ stage: 'system', text: PIPELINE_LOG.complete },
];

export const TAG_HISTORY = [BUILD_ID, '0199a2c8-90f1-7d3a-b6e4-1c7f20a9d5e2', '0199a1b0-3e5c-7a19-8d72-f04b6c1e9a37'];
