// @ts-check

import { NodeSSH } from 'node-ssh';
import { WebSocketServer } from 'ws';
import logger from './logger.js';
import { generateSshKeyPair, fetchOinitCertificate } from './oinit.js';

const CLOSE_REASON = {
	normal: { code: 1000, data: 'Websocket was closed normally' },
	logout: { code: 4000, data: 'User logged out' },
	error: { code: 4001, data: 'An error occurred' },
	timeout: { code: 4002, data: 'Session timed out' }
};

/**
 * Open an SSH session over a WebSocket.
 *
 * Used both by the production Express server (server.js) and by the Vite dev
 * server (see the `ws-bridge` plugin in vite.config.ts).
 *
 * @param {import('ws').WebSocket} ws
 * @param {{ headers: import('http').IncomingHttpHeaders, query: Record<string, any> }} request
 */
export async function handleConnection(ws, request) {
	const sshMethod = process.env.SSH_METHOD || 'mccli';
	const oinitEndpoint = process.env.OINIT_ENDPOINT;

	logger.debug('[ws-bridge] WebSocket /connect request received');
	const accessToken = request.headers['sec-websocket-protocol'];
	const sshHostname = request.query.sshHostname?.toString();
	const sshPort = Number(request.query.sshPort?.toString());
	const username = request.query.username?.toString();

	logger.debug(
		{
			hasAccessToken: !!accessToken,
			sshHostname,
			sshPort,
			username
		},
		'[ws-bridge] Connection params'
	);

	if (!accessToken) {
		logger.error('[ws-bridge] Missing access token');
		ws.close(CLOSE_REASON.error.code, "Missing 'sec-websocket-protocol' header");
		return;
	}
	if (!sshHostname) {
		logger.error('[ws-bridge] Missing sshHostname');
		ws.close(CLOSE_REASON.error.code, "Missing 'sshHostname' query parameter");
		return;
	}
	if (!sshPort) {
		logger.error('[ws-bridge] Missing sshPort');
		ws.close(CLOSE_REASON.error.code, "Missing 'sshPort' query parameter");
		return;
	}
	if (!username) {
		logger.error('[ws-bridge] Missing username');
		ws.close(CLOSE_REASON.error.code, "Missing 'username' query parameter");
		return;
	}

	logger.debug(
		`[ws-bridge] Attempting SSH connection to ${sshHostname}:${sshPort} using method: ${sshMethod}`
	);

	const ssh = new NodeSSH();
	let sshConnection;

	if (sshMethod === 'oinit') {
		// Certificate-based authentication via oinit CA
		logger.debug('[ws-bridge] Using oinit certificate authentication');

		// Try to get credentials from query params (passed from SvelteKit)
		const oinitPrivateKeyB64 = request.query.oinitPrivateKey?.toString();
		const oinitCertificateB64 = request.query.oinitCertificate?.toString();

		let privateKey;
		let certificate;

		if (oinitPrivateKeyB64 && oinitCertificateB64) {
			// Use credentials passed from SvelteKit (base64 decode)
			privateKey = Buffer.from(oinitPrivateKeyB64, 'base64').toString('utf-8');
			certificate = Buffer.from(oinitCertificateB64, 'base64').toString('utf-8');
			logger.debug('[ws-bridge] Using oinit credentials from SvelteKit session');
		} else {
			// Fallback: generate new credentials (shouldn't happen normally)
			logger.warn('[ws-bridge] No oinit credentials in request, generating new ones');

			if (!oinitEndpoint) {
				logger.error('[ws-bridge] OINIT_ENDPOINT not configured');
				ws.close(CLOSE_REASON.error.code, 'oinit endpoint not configured');
				return;
			}

			const oinitCertUrl = `${oinitEndpoint}/${sshHostname}/certificate`;
			logger.debug(`[ws-bridge] oinitCertUrl ${oinitCertUrl}`);

			const keyPair = generateSshKeyPair();
			logger.debug('[ws-bridge] Generated ephemeral SSH key pair');

			certificate = await fetchOinitCertificate(accessToken, keyPair.publicKey, oinitCertUrl);
			if (!certificate) {
				ws.close(CLOSE_REASON.error.code, 'Failed to obtain SSH certificate from oinit CA');
				return;
			}
			privateKey = keyPair.privateKey;
		}

		sshConnection = await ssh
			.connect({
				host: sshHostname,
				port: sshPort,
				username: 'oinit',
				privateKey: privateKey,
				certificate: certificate
			})
			.catch((err) => {
				logger.error(`[ws-bridge] SSH connection failed (oinit): ${err.message || err}`);
				logger.error(
					`[ws-bridge] Full error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`
				);
				ws.close(CLOSE_REASON.error.code, `Failed to connect to SSH server: ${err.message}`);
				return null;
			});
	} else {
		// Default: mccli keyboard-interactive authentication
		logger.debug('[ws-bridge] Using mccli keyboard-interactive authentication');

		sshConnection = await ssh
			.connect({
				host: sshHostname,
				port: sshPort,
				username: username,
				tryKeyboard: true,
				onKeyboardInteractive: (
					/** @type {string} */ name,
					/** @type {string} */ instructions,
					/** @type {string} */ instructionsLang,
					/** @type {{ prompt: string, echo?: boolean }[]} */ prompts,
					/** @type {(responses: string[]) => void} */ finish
				) => {
					logger.debug(
						{ name, prompts: prompts.map((p) => p.prompt) },
						'[ws-bridge] Keyboard interactive auth'
					);
					if (prompts.length > 0 && prompts[0].prompt.includes('Access Token')) {
						logger.debug('[ws-bridge] Providing access token for authentication');
						finish([accessToken]);
					}
				}
			})
			.catch((err) => {
				logger.error('[ws-bridge] SSH connection failed (mccli):', err.message);
				ws.close(CLOSE_REASON.error.code, `Failed to connect to SSH server: ${err.message}`);
				return null;
			});
	}

	if (!sshConnection) {
		logger.error('[ws-bridge] SSH connection is null, aborting');
		return;
	}

	logger.debug('[ws-bridge] SSH connected successfully, requesting shell...');

	const channel = await sshConnection
		.requestShell({
			term: 'xterm-256color'
		})
		.catch((err) => {
			logger.error('[ws-bridge] Failed to open shell:', err.message);
			ws.close(CLOSE_REASON.error.code, `Failed to open shell: ${err.message}`);
			return null;
		});

	if (!channel) {
		logger.error('[ws-bridge] Shell channel is null, aborting');
		return;
	}

	logger.debug('[ws-bridge] Shell opened successfully');

	channel.addListener('data', (/** @type {Buffer} */ data) => {
		ws.send(data.toString('utf8'));
	});

	channel.addListener('close', () => {
		ws.close(CLOSE_REASON.normal.code, CLOSE_REASON.normal.data);
	});

	channel.addListener('error', (/** @type {Error} */ err) => {
		ws.close(CLOSE_REASON.error.code, CLOSE_REASON.error.data + ': ' + err);
	});

	ws.on('resize', (msg) => {
		channel.setWindow(msg.rows, msg.cols, msg.height, msg.width);
	});

	ws.on('message', (msg) => {
		if (channel.writable) {
			channel.write(msg);
		} else {
			logger.warn({ message: msg }, 'Channel not writable. Message dismissed');
		}
	});

	ws.on('close', () => {
		try {
			channel.close();
			sshConnection.dispose();
		} catch (_) {
			logger.warn('some oopsie happened.');
		}
	});
}

/**
 * Attach the SSH bridge to an HTTP server.
 *
 * @param {import('http').Server} server
 */
export function attachWsBridge(server) {
	const wss = new WebSocketServer({ noServer: true });

	server.on('upgrade', (req, socket, head) => {
		const url = new URL(req.url ?? '/', 'http://localhost');
		if (url.pathname !== '/ws/connect') return;

		wss.handleUpgrade(req, socket, head, (ws) => {
			handleConnection(ws, {
				headers: req.headers,
				query: Object.fromEntries(url.searchParams)
			});
		});
	});

	server.on('close', () => wss.close());
	return wss;
}
