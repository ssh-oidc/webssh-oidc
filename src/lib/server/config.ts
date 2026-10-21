import config from 'config';
import { env } from '$env/dynamic/private';

export type ProviderConfig = {
	issuer: string;
	clientId: string;
	clientSecret: string;
	id?: string;
	name?: string;
};

const CONFIG = {
	// empty list of providers if not configured
	providers: (config.has('providers') ? config.get('providers') : []) as ProviderConfig[],

	// Public MC endpoint — used by the browser to reach motley-cue
	mcEndpoint: env.MC_ENDPOINT,

	// Internal MC endpoint — used by server-side code to reach motley-cue
	// Defaults to mcEndpoint if not set (useful in Docker-compose setups)
	internalMcEndpoint: env.INTERNAL_MC_ENDPOINT || env.MC_ENDPOINT,

	oinitEndpoint: env.OINIT_ENDPOINT,
	sshHostname: env.SSH_HOSTNAME,
	sshInternalHost: {
		hostname: env.SSH_INTERNAL_HOSTNAME || env.SSH_HOSTNAME,
		port: parseInt(env.SSH_PORT) || 22
	} as { hostname: string; port: number }
};

export default CONFIG;
