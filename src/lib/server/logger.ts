import pino from 'pino';
import pretty from 'pino-pretty';

// Use pino-pretty as a destination stream instead of a worker-thread transport:
// Vite's dev SSR cannot resolve the transport target ("pino-pretty").
const logger = pino(
	{
		level: process.env.LOG_LEVEL || 'info'
	},
	pretty({
		colorize: true,
		translateTime: 'HH:MM:ss',
		ignore: 'pid,hostname'
	})
);

export default logger;
