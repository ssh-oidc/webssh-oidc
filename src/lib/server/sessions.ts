export interface TerminalSessionInfo {
	id: string;
	name: string;
}

export interface UserSession {
	token: string;
	mcEndpoint: string;
	sshHostname: string;
	sshPort: number;
	terminals: TerminalSessionInfo[];
	creationTime: number;
	// oinit certificate credentials (generated on demand)
	oinitPrivateKey?: string;
	oinitCertificate?: string;
}

export function createUserSession(
	token: string,
	mcEndpoint: string,
	sshHostname: string,
	sshPort: number
): UserSession {
	const data = { token, mcEndpoint, sshHostname, sshPort, terminals: [], creationTime: Date.now() };
	sessionStore.set(token, data);
	return data;
}

export function getUserSession(token: string): UserSession | undefined {
	const session = sessionStore.get(token);
	return session;
}

function clearStore() {
	const now = Date.now();
	for (const [key, value] of sessionStore.entries()) {
		if (now - value.creationTime > 24 * 60 * 60 * 1000) {
			sessionStore.delete(key);
		}
	}
}

// clear session store every 24 hours
setInterval(
	() => {
		clearStore();
	},
	24 * 60 * 60 * 1000
);

export const sessionStore = new Map<string, UserSession>();
