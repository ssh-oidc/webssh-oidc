import { getSshUser } from '$lib/motley_cue';
import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import CONFIG from '$lib/server/config';
import logger from '$lib/server/logger';
import { generateSshKeyPair, fetchOinitCertificate } from '$lib/server/oinit';

export const load = (async ({ locals }) => {
	if (!locals.session?.accessToken) {
		return error(403, new Error('Unauthorized'));
	}

	const session = locals.userSession;

	// mcEndpoint: public URL used by the browser to reach motley-cue
	// internalMcEndpoint: URL used by server-side code (may differ in Docker setups)
	const mcEndpoint = new URL(CONFIG.mcEndpoint || session.mcEndpoint);
	const internalMcEndpoint = new URL(CONFIG.internalMcEndpoint || session.mcEndpoint);

	logger.debug('[+layout.server] mcEndpoint (browser):', mcEndpoint.href);
	logger.debug('[+layout.server] internalMcEndpoint (server):', internalMcEndpoint.href);

	const username = await getSshUser(fetch, internalMcEndpoint, session.token)
		.then((sshUser) => {
			logger.debug('[+layout.server] getSshUser returned:', sshUser);
			return sshUser?.username ?? '';
		})
		.catch((e) => {
			logger.error('[+layout.server] getSshUser failed:', e);
			return '';
		});

	// Generate oinit credentials if configured and not already generated
	if (CONFIG.oinitEndpoint && !session.oinitPrivateKey) {
		try {
			const keyPair = generateSshKeyPair();
			const endpoint = `${CONFIG.oinitEndpoint}/${CONFIG.sshHostname || session.sshHostname}/certificate`;
			const certificate = await fetchOinitCertificate(
				locals.session.accessToken,
				keyPair.publicKey,
				endpoint
			);
			if (certificate) {
				session.oinitPrivateKey = keyPair.privateKey;
				session.oinitCertificate = certificate;
				logger.debug('[+layout.server] Generated oinit credentials');
			}
		} catch (e) {
			logger.error('[+layout.server] Failed to generate oinit credentials:', e);
		}
	}

	return {
		userId: locals.session?.user?.id,
		accessToken: locals.session?.accessToken,
		terminalSessions: locals.userSession.terminals,
		userSession: locals.userSession,
		username: username,
		sshHostname: CONFIG.sshHostname,
		oinitPrivateKey: session.oinitPrivateKey,
		oinitCertificate: session.oinitCertificate,
		session: locals.session
	};
}) satisfies LayoutServerLoad;
