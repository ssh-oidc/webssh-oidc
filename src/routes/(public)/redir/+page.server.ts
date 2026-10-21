import type { PageServerLoad } from './$types';

import { redirect } from '@sveltejs/kit';

import { createUserSession } from '$lib/server/sessions';
import logger from '$lib/server/logger';

export const load = (async (e) => {
	const data = {
		token: e.locals.session?.accessToken,
		mcEndpoint: e.url.searchParams.get('mcEndpoint'),
		sshHostname: e.url.searchParams.get('sshHostname'),
		sshPort: Number(e.url.searchParams.get('sshPort') || 22)
	};

	logger.debug(
		{
			hasToken: !!data.token,
			mcEndpoint: data.mcEndpoint,
			sshHostname: data.sshHostname,
			sshPort: data.sshPort
		},
		'[redir] Received callback with data'
	);

	if (!data.token || !data.mcEndpoint || !data.sshHostname) {
		logger.error('[redir] Missing required data, redirecting to login');
		return redirect(302, '/login');
	}

	// Validate that mcEndpoint is a properly formed URL
	try {
		const mcUrl = new URL(data.mcEndpoint);
		logger.debug(
			{
				href: mcUrl.href,
				hostname: mcUrl.hostname,
				port: mcUrl.port,
				pathname: mcUrl.pathname
			},
			'[redir] Parsed mcEndpoint URL'
		);
	} catch (err) {
		logger.error(
			`[redir] Invalid mcEndpoint URL: ${data.mcEndpoint} (${err instanceof Error ? err.message : String(err)})`
		);
	}

	createUserSession(data.token, data.mcEndpoint, data.sshHostname, data.sshPort);

	return redirect(302, '/terminal');
}) satisfies PageServerLoad;
