// Client-side logger that respects environment settings
// Uses Vite's import.meta.env to check mode and environment variables

const isDev = import.meta.env.DEV;
const logLevel = import.meta.env.VITE_LOG_LEVEL || (isDev ? 'debug' : 'info');

const levels = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};

const currentLevel = levels[logLevel as keyof typeof levels] ?? levels.info;

function shouldLog(level: keyof typeof levels): boolean {
	return levels[level] >= currentLevel;
}

const clientLogger = {
	debug: (...args: any[]) => {
		if (shouldLog('debug')) {
			console.debug(...args);
		}
	},
	info: (...args: any[]) => {
		if (shouldLog('info')) {
			console.info(...args);
		}
	},
	warn: (...args: any[]) => {
		if (shouldLog('warn')) {
			console.warn(...args);
		}
	},
	error: (...args: any[]) => {
		if (shouldLog('error')) {
			console.error(...args);
		}
	}
};

export default clientLogger;
