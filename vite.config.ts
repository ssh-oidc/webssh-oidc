import 'dotenv/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { WebSocketServer } from 'ws';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { handleConnection } from './ws-bridge.js';

/**
 * Serve the SSH/WebSocket bridge from the Vite dev server itself, so `npm run
 * dev` is enough. In production server.js attaches the same handler to its HTTP server.
 */
function wsBridge(): Plugin {
	return {
		name: 'ws-bridge',
		configureServer(server) {
			const httpServer = server.httpServer;
			// Vitest and other middleware-mode consumers have no HTTP server to
			// attach to; the bridge is only needed by the real dev server.
			if (!httpServer) return;

			const wss = new WebSocketServer({ noServer: true });

			httpServer.on('upgrade', (req, socket, head) => {
				let url: URL;
				try {
					url = new URL(req.url ?? '/', 'http://localhost');
				} catch {
					socket.destroy();
					return;
				}
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
	plugins: [tailwindcss(), sveltekit(), wsBridge()],
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
