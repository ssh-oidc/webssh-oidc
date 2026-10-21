import type { OAuthUserConfig, OAuthConfig } from '@auth/core/providers';

export interface EgiProfile extends Record<string, any> {
	aud: string;
	azp: string;
	exp: number;
	iat: number;
	iss: string;
	jti: string;
	nbf: number;
	sub: string;

	auth_time: number;
	typ: string;
	session_state: string;
	sid: string;
	authenticating_authority: string;

	acr: string;
	cert_entitlement: string;
	eduperson_assurance: string;
	eduperson_entitlement: string[];
	voperson_id: string;
	voperson_external_affiliation: string[];
	voperson_verified_email: string;
	email: string;
	email_verified: string;
	family_name: string;
	given_name: string;
	name: string;
	orcid: string;
	preferred_username: string;
	ssh_public_key: string;
	entitlements: string[];
}

export default function Egi<P extends EgiProfile>(options: OAuthUserConfig<P>): OAuthConfig<P> {
	return {
		id: 'egi',
		name: 'EGI',
		type: 'oidc',
		issuer: 'https://aai.egi.eu/auth/realms/egi',
		authorization: {
			params: {
				scope: 'openid profile email entitlements voperson_external_affiliation voperson_id'
			}
		},
		checks: ['pkce', 'state'],
		async profile(profile, tokens) {
			// the profile doesn't have an email or name, try to query the userinfo endpoint
			const response = await fetch(`${this.issuer}/protocol/openid-connect/userinfo`, {
				headers: { Authorization: `Bearer ${tokens.access_token}` },
				method: 'GET'
			});

			const userinfo = await response.json();
			if (!response.ok) throw new Error('error');

			return {
				id: profile.sub,
				...profile,
				...userinfo
			};
		},
		...options
	};
}
