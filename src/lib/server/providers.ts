import Google from '@auth/core/providers/google';
import DeepHDC from '$lib/server/providers/deephdc';
import Helmholtz from '$lib/server/providers/helmholtz';
import HelmholtzDev from '$lib/server/providers/helmholtz_dev';
import Egi from '$lib/server/providers/egi';
import EgiDev from '$lib/server/providers/egi_dev';
import EgiDemo from '$lib/server/providers/egi_demo';
import SimpleSaml from '$lib/server/providers/simplesaml';
import Wlcg from '$lib/server/providers/wlcg';
import eduTEAMS from '$lib/server/providers/eduteams';
import Generic from '$lib/server/providers/generic';
// import KIT from '$lib/server/providers/kit';
// import NfdiInfra from '$lib/server/providers/nfdi-infra';
// import KitFels from '$lib/server/providers/fels-kit-edu';

import type { ProviderConfig } from '$lib/server/config';
import CONFIG from '$lib/server/config';
import logger from '$lib/server/logger';
import { providers as providerLogos, generic } from '$lib/providers';

logger.debug(
	{
		providers: CONFIG.providers.map(({ issuer, clientId, name, id }) => ({
			issuer,
			clientId,
			name,
			id
		})),
		mcEndpoint: CONFIG.mcEndpoint,
		internalMcEndpoint: CONFIG.internalMcEndpoint,
		sshHostname: CONFIG.sshHostname,
		sshInternalHost: CONFIG.sshInternalHost
	},
	'CONFIG object loaded'
);

const providers = CONFIG.providers.map((config) => withLogo(loadProvider(config), config.issuer));

// Auth.js' built-in signin page (used for error pages) defaults to
// https://authjs.dev/img/providers/<id>.svg, which only exists for a handful
// of providers. Point it at the logos we ship instead.
function withLogo<T extends { style?: unknown }>(provider: T, issuer: string): T {
	const logo = providerLogos[issuer.trim().replace(/\/+$/, '')]?.logo ?? generic.logo;
	return { ...provider, style: { ...(provider.style as Record<string, unknown>), logo } };
}

function loadProvider(provider_config: ProviderConfig) {
	const auth = {
		clientId: provider_config.clientId,
		clientSecret: provider_config.clientSecret
	};
	const issuer = provider_config.issuer
		.trim() // remove leading and trailing whitespace
		.replace(/\/+$/, ''); // remove trailing slashes
	logger.debug(`Issuer: ${issuer}`);
	switch (issuer) {
		case 'https://accounts.google.com':
			return Google(auth);
		case 'https://aai-dev.egi.eu/auth/realms/egi':
			return EgiDev(auth);
		case 'https://aai-demo.egi.eu/auth/realms/egi':
			return EgiDemo(auth);
		case 'https://aai.egi.eu/auth/realms/egi':
			return Egi(auth);
		case 'https://iam.deep-hybrid-datacloud.eu':
			return DeepHDC(auth);
		case 'https://login-dev.helmholtz.de/oauth2':
			return HelmholtzDev(auth);
		case 'https://login.helmholtz.de/oauth2':
			return Helmholtz(auth);
		case 'https://wlcg.cloud.cnaf.infn.it':
			return Wlcg(auth);
		case 'https://proxy.eduteams.org':
			return eduTEAMS(auth);
		case 'https://et3.gndev.hexaa.eu':
			return SimpleSaml(auth);
		// case 'https://infraproxy.nfdi-aai.dfn.de':
		//     return NfdiInfra(auth);
		// case 'https://oidc.scc.kit.edu/auth/realms/kit':
		//     // return KIT(auth);
		//     return Generic(provider_config);
		default:
			logger.debug(`Issuer ${issuer} supported via generic provider.`);
			return Generic(provider_config);
	}
}

export default providers;
