import 'dotenv/config';
import { sveltekit } from '@sveltejs/kit/vite';
import WebSocket from 'ws';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { handleConnection } from './ws-bridge.js';

type BridgeSocket = Parameters<typeof handleConnection>[0];

interface UpgradeServer {
	handleUpgrade(
		req: import('http').IncomingMessage,
		socket: import('stream').Duplex,
		head: Buffer,
		callback: (ws: BridgeSocket) => void
	): void;
	close(): void;
}

// ws ships as CommonJS; Node's ESM loader cannot use its named exports.
const WebSocketServer = (
	WebSocket as unknown as { Server: new (options: { noServer: boolean }) => UpgradeServer }
).Server;

/**
 * Serve the SSH/WebSocket bridge from the Vite dev server itself, so `npm run
 * dev` is enough. In production server.js mounts the same handler on Express.
 */
function wsBridge(): Plugin {
	return {
		name: 'ws-bridge',
		configureServer(server) {
			const httpServer = server.httpServer;
			if (!httpServer) throw new Error('ws-bridge: Vite HTTP server is not available');

			const wss = new WebSocketServer({ noServer: true });

			httpServer.on('upgrade', (req, socket, head) => {
				const url = new URL(req.url ?? '/', 'http://localhost');
				if (url.pathname !== '/ws/connect') return;

				wss.handleUpgrade(req, socket, head, (ws) => {
					handleConnection(ws, {
						headers: req.headers,
						query: Object.fromEntries(url.searchParams)
					});
				});
			});

			httpServer.on('close', () => wss.close());
		}
	};
}

export default defineConfig({
	plugins: [sveltekit(), wsBridge()],
	server: {
		// Listen on all interfaces so Caddy (running in Docker) can reach the
		// dev server through the host gateway (host.docker.internal).
		host: true,
		port: 8444,
		strictPort: false
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
