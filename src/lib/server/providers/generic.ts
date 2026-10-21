import type { OAuthUserConfig, OAuthConfig } from '@auth/core/providers';
import { customFetch } from '@auth/core';
import logger from '$lib/server/logger';

export interface GenericProfile extends Record<string, any> {
	aud: string;
	azp: string;
	email: string;
	email_verified: boolean;
	exp: number;
	family_name: string;
	given_name: string;
	hd: string;
	iat: number;
	iss: string;
	jti: string;
	name: string;
	nbf: number;
	picture: string;
	sub: string;
	preferred_username: string;
}

// Custom fetch that follows redirects (oauth4webapi uses redirect: 'manual'
// which breaks OPs that redirect .well-known/openid-configuration)
const followRedirectsFetch: typeof fetch = (url, options) => {
	return fetch(url, { ...options, redirect: 'follow' });
};

export default function Generic<P extends GenericProfile>(
	options: OAuthUserConfig<P>
): OAuthConfig<P> {
	const config = {
		id: 'generic',
		name: 'Generic Provider',
		type: 'oidc',
		checks: ['pkce', 'state'],
		[customFetch]: followRedirectsFetch,
		...options
	};
	logger.debug(`GENERIC provider final config:${JSON.stringify(config, null, 2)}`);
    return config;
}
