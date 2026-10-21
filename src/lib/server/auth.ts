import { SvelteKitAuth } from '@auth/sveltekit';
import type { Action, Handle } from '@sveltejs/kit';

import providers from '$lib/server/providers';
import logger from '$lib/server/logger';

// hook for auth.js oidc authentication
export const { handle, signIn, signOut } = SvelteKitAuth({
	trustHost: true,
	debug: process.env.LOG_LEVEL === 'debug',
    useSecureCookies: process.env.NODE_ENV === 'production',
	providers: providers,
	logger: {
		error(error: Error) {
			const name = error.name || 'UnknownError';
			logger.error(`[auth.js] ${name}: ${error.message}`);
			if (error.cause && typeof error.cause === 'object') {
				const cause = error.cause as Record<string, unknown>;
				// AuthError flattens the original error's cause into its own cause object:
				// { err: OriginalError, ...OriginalError.cause, ...errorOptions }
				if (cause.err instanceof Error) {
					logger.error(`[auth.js]   cause: ${cause.err.name}: ${cause.err.message}`);
					if ('code' in cause.err) logger.error(`[auth.js]   error code: ${(cause.err as any).code}`);
				}
				// For issuer mismatch errors, these are flattened from OperationProcessingError.cause
				if (cause.expected) logger.error(`[auth.js]   expected issuer: ${cause.expected}`);
				if (cause.attribute) logger.error(`[auth.js]   attribute: ${cause.attribute}`);
				if (cause.body && typeof cause.body === 'object' && 'issuer' in cause.body) {
					logger.error(`[auth.js]   actual issuer: ${(cause.body as any).issuer}`);
				}
				if (cause.provider) logger.error(`[auth.js]   provider: ${cause.provider}`);
			}
		},
		warn(code: string) {
			logger.warn(`[auth.js] Warning: ${code}`);
		},
		debug(message: string, metadata?: unknown) {
			logger.debug(`[auth.js] ${message}`, metadata ? JSON.stringify(metadata, null, 2) : '');
		}
	},
	callbacks: {
		async jwt({ token, account, user, profile }) {
			// Persist the OIDC access_token to the token right after signin
			if (account) {
				// check if access token is present
				if (!account.access_token) {
					throw new Error('Access token not present');
				}
				token.accessToken = account.access_token;
				if (account.expires_in) {
					token.expiresAt = Date.now() + account.expires_in;
				}
			}
			if (profile) {
				if (token.profile) token.profile = { ...token.profile, ...profile };
				else token.profile = profile;
			}
			if (user) {
				if (token.user) token.user = { ...token.user, ...user };
				else token.user = user;
			}
			return token;
		},
		async session({ session, token }) {
			// Send properties to the client, like an access_token from a provider.
			const new_session = {
				...session,
				accessToken: token.accessToken,
				expiresAt: token.expiresAt,
				profile: token.profile
			};
			if (token.user) {
				if (new_session.userinfo) new_session.userinfo = { ...new_session.userinfo, ...token.user };
				else new_session.userinfo = token.user;
			}
			return new_session;
		}
	}
}) satisfies { handle: Handle; signIn: Action; signOut: Action };

declare module '@auth/core/types' {
	interface Session {
		user: {
			id: string;
			name?: string | null;
			email?: string | null;
			preferred_username?: string | null;
		};
		expiresAt: number;
		accessToken: string;
		profile: { [key: string]: string | number | boolean | string[] };
		userinfo: { [key: string]: string | number | boolean | string[] } | {};
	}
}

declare module '@auth/core/jwt' {
	interface JWT {
		accessToken: string;
		expiresAt: number;
	}
}
