import sshpk from 'sshpk';
import logger from './logger';

/**
 * Generate an ephemeral SSH key pair for oinit certificate authentication
 */
export function generateSshKeyPair(): { privateKey: string; publicKey: string } {
	const key = sshpk.generatePrivateKey('ed25519');
	logger.debug('[oinit.ts] Generated ephemeral ed25519 key pair');
	return {
		privateKey: key.toString('openssh'),
		publicKey: key.toPublic().toString('ssh')
	};
}

/**
 * Fetch SSH certificate from oinit CA
 */
export async function fetchOinitCertificate(
	accessToken: string,
	publicKey: string,
	endpoint: string
): Promise<string | null> {
	// Normalize endpoint URL - remove double slashes (except after protocol)
	const normalizedEndpoint = endpoint.replace(/([^:]\/)\/+/g, '$1');

	const requestBody = {
		Publickey: publicKey,
		Token: accessToken
	};

	logger.debug(`[oinit.ts] Calling oinit CA endpoint: ${normalizedEndpoint}`);
	logger.debug(`[oinit.ts] Request body: ${JSON.stringify(requestBody, null, 2)}`);

	const response = await fetch(normalizedEndpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text();
		logger.error(`[oinit.ts] CA request failed: status=${response.status} body=${errorText}`);
		return null;
	}

	const data = await response.json();
	// logger.debug(`[oinit.ts] CA response received: ${data.certificate?.substring(0, 80)}...`);
	logger.debug(`[oinit.ts] CA response received: ${data.certificate}`);
	return data.certificate;
}
