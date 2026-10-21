import { z } from 'zod';
import logger from '$lib/clientLogger';

type Fetch = (input: URL | RequestInfo, init?: RequestInit | undefined) => Promise<Response>;

const ABORT_TIMEOUT = 10000;

/**
 * Safely append a path segment to a URL, ensuring proper slash handling.
 * Handles cases where base path may or may not have a trailing slash.
 */
const appendPath = (baseUrl: URL, path: string): URL => {
	const url = new URL(baseUrl);
	// Ensure base pathname ends with / before appending
	if (!url.pathname.endsWith('/')) {
		url.pathname += '/';
	}
	// Remove leading slash from path if present
	url.pathname += path.replace(/^\//, '');
	return url;
};

export const loadOps = async (fetch: Fetch, mcEndpoint: URL) => {
	const url = appendPath(mcEndpoint, 'info');
    logger.debug('[motley_cue] loadOps: mcEndpoint =', mcEndpoint.toString());
    logger.debug('[motley_cue] loadOps: final URL =', url.toString());

	const response = await fetch(url, { signal: AbortSignal.timeout(ABORT_TIMEOUT) });
	if (response.ok) {
		const text = await response.text();
		let jsonRaw;
		try {
			jsonRaw = JSON.parse(text);
		} catch (e) {
			logger.error(`[motley_cue] loadOps: response from ${url} is not valid JSON. Content-Type: ${response.headers.get('content-type')}. Body (first 500 chars): ${text.substring(0, 500)}`);
			throw new Error(`Response from ${url} is not valid JSON (got ${response.headers.get('content-type')})`);
		}

		const schema = z.object({
			supported_OPs: z.array(z.string())
		});

		const parsedAPIResponse = schema.safeParse(jsonRaw);
		if (!parsedAPIResponse.success) {
			throw new Error(`Failed to parse API response: ${parsedAPIResponse.error.errors}`);
		}

		const supportedOPs = parsedAPIResponse.data.supported_OPs;
		return supportedOPs.map((op: string) => op.trim().replace(/\/+$/, ''));
	} else {
		const body = await response.text().catch(() => '(could not read body)');
		logger.error(`[motley_cue] loadOps: ${url} returned ${response.status} ${response.statusText}. Body (first 500 chars): ${body.substring(0, 500)}`);
		throw new Error(`Could not get info from ${url} (${response.status} ${response.statusText})`);
	}
};

export const loadOpInfo = async (fetch: Fetch, mcEndpoint: URL, opUrl: string) => {
	const url = appendPath(mcEndpoint, 'info/op');
	url.searchParams.set('url', opUrl);
    logger.debug('[motley_cue] loadOpInfo: mcEndpoint =', mcEndpoint.toString());
    logger.debug('[motley_cue] loadOpInfo: final URL =', url.toString());

	const response = await fetch(url, { signal: AbortSignal.timeout(ABORT_TIMEOUT) });
	if (response.ok) {
		const text = await response.text();
		let jsonRaw;
		try {
			jsonRaw = JSON.parse(text);
		} catch (e) {
			logger.error(`[motley_cue] loadOpInfo: response from ${url} is not valid JSON. Content-Type: ${response.headers.get('content-type')}. Body (first 500 chars): ${text.substring(0, 500)}`);
			throw new Error(`Response from ${url} is not valid JSON for OP ${opUrl} (got ${response.headers.get('content-type')})`);
		}

		const schema = z.object({
			scopes: z.array(z.string()),
			audience: z.string()
		});

		const parsedAPIResponse = schema.safeParse(jsonRaw);
		if (!parsedAPIResponse.success) {
			throw new Error(`Failed to parse API response: ${parsedAPIResponse.error.errors}`);
		}

		return parsedAPIResponse.data;
	} else {
		const body = await response.text().catch(() => '(could not read body)');
		logger.error(`[motley_cue] loadOpInfo: ${url} returned ${response.status} ${response.statusText}. Body (first 500 chars): ${body.substring(0, 500)}`);
		throw new Error(
			`Could not get info for OP ${opUrl} (${response.status} ${response.statusText})`
		);
	}
};

export const deployUser = async (fetch: Fetch, mcEndpoint: URL, accessToken: string) => {
	const url = appendPath(mcEndpoint, 'user/deploy');
    logger.debug('[motley_cue] deployUser: mcEndpoint =', mcEndpoint.toString());
    logger.debug('[motley_cue] deployUser: final URL =', url.toString());

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`
		},
		signal: AbortSignal.timeout(ABORT_TIMEOUT)
	});

	if (response.ok) {
		const text = await response.text();
		let jsonRaw;
		try {
			jsonRaw = JSON.parse(text);
		} catch (e) {
			logger.error(`[motley_cue] deployUser: response from ${url} is not valid JSON. Content-Type: ${response.headers.get('content-type')}. Body (first 500 chars): ${text.substring(0, 500)}`);
			throw new Error(`Response from ${url} is not valid JSON (got ${response.headers.get('content-type')})`);
		}

		const schema = z.object({
			state: z.string(),
			credentials: z.object({
				ssh_user: z.string()
			})
		});

		const parsedAPIResponse = schema.safeParse(jsonRaw);
		if (!parsedAPIResponse.success) {
			throw new Error(`Failed to parse API response: ${parsedAPIResponse.error.errors}`);
		}

		return parsedAPIResponse.data;
	} else {
		const body = await response.text().catch(() => '(could not read body)');
		logger.error(`[motley_cue] deployUser: ${url} returned ${response.status} ${response.statusText}. Body (first 500 chars): ${body.substring(0, 500)}`);
		throw new Error(`Could not deploy user (${response.status} ${response.statusText})`);
	}
};

export const getUserStatus = async (fetch: Fetch, mcEndpoint: URL, accessToken: string) => {
	const url = appendPath(mcEndpoint, 'user/status');
    logger.debug('[motley_cue] getUserStatus: mcEndpoint =', mcEndpoint.toString());
    logger.debug('[motley_cue] getUserStatus: final URL =', url.toString());

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`
		},
		signal: AbortSignal.timeout(ABORT_TIMEOUT)
	});

	if (response.ok) {
		const text = await response.text();
		let jsonRaw;
		try {
			jsonRaw = JSON.parse(text);
		} catch (e) {
			logger.error(`[motley_cue] getUserStatus: response from ${url} is not valid JSON. Content-Type: ${response.headers.get('content-type')}. Body (first 500 chars): ${text.substring(0, 500)}`);
			throw new Error(`Response from ${url} is not valid JSON (got ${response.headers.get('content-type')})`);
		}

		const schema = z.object({
			state: z.string(),
			message: z.string(),
			// username is populated by /user/status when an account exists;
			// omitted (via response_model_exclude_unset) when not_deployed.
			username: z.string().optional()
		});

		const parsedAPIResponse = schema.safeParse(jsonRaw);
		if (!parsedAPIResponse.success) {
			throw new Error(`Failed to parse API response: ${parsedAPIResponse.error.errors}`);
		}

		return parsedAPIResponse.data;
	} else {
		const body = await response.text().catch(() => '(could not read body)');
		logger.error(`[motley_cue] getUserStatus: ${url} returned ${response.status} ${response.statusText}. Body (first 500 chars): ${body.substring(0, 500)}`);
		throw new Error(`Could not get user status (${response.status} ${response.statusText})`);
	}
};

export const getSshUser = async (fetch: Fetch, mcEndpoint: URL, accessToken: string) => {
    logger.debug('[motley_cue] getSshUser: mcEndpoint =', mcEndpoint.toString());
    logger.debug('[motley_cue] getSshUser: mcEndpoint.hostname =', mcEndpoint.hostname);
    logger.debug('[motley_cue] getSshUser: mcEndpoint.port =', mcEndpoint.port);
    logger.debug('[motley_cue] getSshUser: mcEndpoint.pathname =', mcEndpoint.pathname);
	let status = await getUserStatus(fetch, mcEndpoint, accessToken);
    logger.debug('[motley_cue] getSshUser: status =', JSON.stringify(status));

	if (status.state === 'not_deployed') {
		let deployment = await deployUser(fetch, mcEndpoint, accessToken);
        logger.debug('[motley_cue] getSshUser: deployment =', JSON.stringify(deployment));
		if (deployment.state === 'deployed') {
			return { username: deployment.credentials.ssh_user };
		}
	} else {
		// Prefer the typed username field from /user/status; fall back to
		// parsing it out of the human-readable message for older motley_cue.
		const username = status.username ?? status.message.split(' ')[1];
        logger.debug('[motley_cue] getSshUser: extracted username =', username);
		return { username };
	}
};
