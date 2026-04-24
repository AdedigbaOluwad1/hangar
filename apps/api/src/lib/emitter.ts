// apps/api/src/lib/emitter.ts
import { EventEmitter } from 'events';

export const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(100);

export function emitLog(deploymentId: string, stream: string, line: string) {
	logEmitter.emit(`log:${deploymentId}`, { stream, line });
}

export function emitDone(deploymentId: string) {
	logEmitter.emit(`done:${deploymentId}`);
}
