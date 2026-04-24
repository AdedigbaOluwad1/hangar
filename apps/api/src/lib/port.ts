// apps/api/src/lib/port.ts
import { createServer } from 'net';

export function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const srv = createServer();
		srv.listen(0, () => {
			const port = (srv.address() as any).port;
			srv.close((err) => (err ? reject(err) : resolve(port)));
		});
	});
}
