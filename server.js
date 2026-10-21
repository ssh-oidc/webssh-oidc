// @ts-check

import { handler } from './build/handler.js';
import { NodeSSH } from 'node-ssh';
import express from 'express';
import ews from 'express-ws';
import logger from './logger.js';
import { generateSshKeyPair, fetchOinitCertificate } from './oinit.js';

const port = process.env.WS_PORT || 8444;
const sshMethod = process.env.SSH_METHOD || 'mccli';
const oinitEndpoint = process.env.OINIT_ENDPOINT;
const sshHostname = process.env.SSH_HOSTNAME;
const sshInternalHostname = process.env.SSH_INTERNAL_HOSTNAME || sshHostname;

const app = express();
ews(app);
var router = express.Router();

const CLOSE_REASON = {
	normal: { code: 1000, data: 'Websocket was closed normally' },
	logout: { code: 4000, data: 'User logged out' },
	error: { code: 4001, data: 'An error occurred' },
	timeout: { code: 4002, data: 'Session timed out' }
};

router.ws('/connect', async function (ws, req) {
    logger.debug('[server.js] WebSocket /connect request received');
	const accessToken = req.headers['sec-websocket-protocol'];
	const sshHostname = req.query.sshHostname?.toString();
	const sshPort = Number(req.query.sshPort?.toString());
	const username = req.query.username?.toString();

    logger.debug('[server.js] Connection params:', {
      hasAccessToken: !!accessToken,
      sshHostname,
      sshPort,
      username
    });

	if (!accessToken) {
		logger.error('[server.js] Missing access token');
		ws.close(CLOSE_REASON.error.code, "Missing 'sec-websocket-protocol' header");
		return;
	}
	if (!sshHostname) {
		logger.error('[server.js] Missing sshHostname');
		ws.close(CLOSE_REASON.error.code, "Missing 'sshHostname' query parameter");
		return;
	}
	if (!sshPort) {
		logger.error('[server.js] Missing sshPort');
		ws.close(CLOSE_REASON.error.code, "Missing 'sshPort' query parameter");
		return;
	}
	if (!username) {
		logger.error('[server.js] Missing username');
		ws.close(CLOSE_REASON.error.code, "Missing 'username' query parameter");
		return;
	}


    logger.debug(`[server.js] Attempting SSH connection to ${sshHostname}:${sshPort} using method: ${sshMethod}`);

	const ssh = new NodeSSH();
	let sshConnection;

	if (sshMethod === 'oinit') {
		// Certificate-based authentication via oinit CA
		logger.debug('[server.js] Using oinit certificate authentication');

		// Try to get credentials from query params (passed from SvelteKit)
		const oinitPrivateKeyB64 = req.query.oinitPrivateKey?.toString();
		const oinitCertificateB64 = req.query.oinitCertificate?.toString();

		let privateKey;
		let certificate;

		if (oinitPrivateKeyB64 && oinitCertificateB64) {
			// Use credentials passed from SvelteKit (base64 decode)
			privateKey = Buffer.from(oinitPrivateKeyB64, 'base64').toString('utf-8');
			certificate = Buffer.from(oinitCertificateB64, 'base64').toString('utf-8');
			logger.debug('[server.js] Using oinit credentials from SvelteKit session');
		} else {
			// Fallback: generate new credentials (shouldn't happen normally)
			logger.warn('[server.js] No oinit credentials in request, generating new ones');

			if (!oinitEndpoint) {
				logger.error('[server.js] OINIT_ENDPOINT not configured');
				ws.close(CLOSE_REASON.error.code, 'oinit endpoint not configured');
				return;
			}

			const oinitCertUrl = `${oinitEndpoint}/${sshHostname}/certificate`;
			logger.debug(`[server.js] oinitCertUrl ${oinitCertUrl}`);

			const keyPair = generateSshKeyPair();
			logger.debug('[server.js] Generated ephemeral SSH key pair');

			certificate = await fetchOinitCertificate(accessToken, keyPair.publicKey, oinitCertUrl);
			if (!certificate) {
				ws.close(CLOSE_REASON.error.code, 'Failed to obtain SSH certificate from oinit CA');
				return;
			}
			privateKey = keyPair.privateKey;
		}

		logger.debug(`[server.js] privkey: ${privateKey?.substring(0, 50)}...`);
		logger.debug(`[server.js] certifi: ${certificate?.substring(0, 50)}...`);

		sshConnection = await ssh
			.connect({
				host: sshHostname,
				port: sshPort,
				username: 'oinit',
				privateKey: privateKey,
				certificate: certificate
			})
			.catch((err) => {
				logger.error(`[server.js] SSH connection failed (oinit): ${err.message || err}`);
				logger.error(`[server.js] Full error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
				ws.close(CLOSE_REASON.error.code, `Failed to connect to SSH server: ${err.message}`);
				return null;
			});
	} else {
		// Default: mccli keyboard-interactive authentication
		logger.debug('[server.js] Using mccli keyboard-interactive authentication');

		sshConnection = await ssh
			.connect({
				host: sshHostname,
				port: sshPort,
				username: username,
				tryKeyboard: true,
				onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
					logger.debug('[server.js] Keyboard interactive auth:', { name, prompts: prompts.map(p => p.prompt) });
					if (prompts.length > 0 && prompts[0].prompt.includes('Access Token')) {
						logger.debug('[server.js] Providing access token for authentication');
						finish([accessToken]);
					}
				}
			})
			.catch((err) => {
				logger.error('[server.js] SSH connection failed (mccli):', err.message);
				ws.close(CLOSE_REASON.error.code, `Failed to connect to SSH server: ${err.message}`);
				return null;
			});
	}

	if (!sshConnection) {
		logger.error('[server.js] SSH connection is null, aborting');
		return;
	}

	logger.debug('[server.js] SSH connected successfully, requesting shell...');

	const channel = await sshConnection
		.requestShell({
			term: 'xterm-256color'
		})
		.catch((err) => {
			logger.error('[server.js] Failed to open shell:', err.message);
			ws.close(CLOSE_REASON.error.code, `Failed to open shell: ${err.message}`);
			return null;
		});

	if (!channel) {
		logger.error('[server.js] Shell channel is null, aborting');
		return;
	}

	logger.debug('[server.js] Shell opened successfully');

	channel.addListener('data', (data) => {
		ws.send(data.toString('utf8'));
	});

	channel.addListener('close', () => {
		ws.close(CLOSE_REASON.normal.code, CLOSE_REASON.normal.data);
	});

	channel.addListener('error', (err) => {
		// console.log('Dead.');
		ws.close(CLOSE_REASON.error.code, CLOSE_REASON.error.data + ': ' + err);
	});

	ws.on('resize', (msg) => {
		// console.log('RESIZE: ', { msg });
		channel.setWindow(msg.rows, msg.cols, msg.height, msg.width);
	});

	ws.on('message', (msg) => {
		if (channel.writable) {
			channel.write(msg);
		} else {
			logger.warn('Channel not writable. Message dismissed: ', msg);
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
});

app.set('trust proxy', 1);
app.use('/ws', router);
app.use(handler);

app.listen(port, async () => {
	logger.info(`Started server on port ${port}. SSH method: ${sshMethod}`);
});

export { app };
