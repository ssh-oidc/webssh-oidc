import type { PageServerLoad } from './$types';
import providers from '$lib/server/providers';
import type { OP } from '$lib/types';
import CONFIG from '$lib/server/config';

export const load = (async () => {
	const providerMap: { [issuer: string]: OP } = providers.reduce(
		(map: { [issuer: string]: OP }, provider) => {
			if (provider.issuer) {
				// Normalize issuer by stripping trailing slash for consistent comparison
				const key = provider.issuer.replace(/\/+$/, '');
				map[key] = {
					id: provider.id,
					issuer: provider.issuer
				};
			}
			return map;
		},
		{}
	);

	return {
		providers: providerMap,
		config: {
			mcEndpoint: CONFIG.mcEndpoint,
			sshInternalHost: CONFIG.sshInternalHost
		}
	};
}) satisfies PageServerLoad;
