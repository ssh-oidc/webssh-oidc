// @ts-check

import { handler } from './build/handler.js';
import express from 'express';
import logger from './logger.js';
import { attachWsBridge } from './ws-bridge.js';

const port = process.env.WS_PORT || 8444;
const sshMethod = process.env.SSH_METHOD || 'mccli';

const app = express();
attachWsBridge(app);

app.set('trust proxy', 1);
app.use(handler);

app.listen(port, async () => {
	logger.info(`Started server on port ${port}. SSH method: ${sshMethod}`);
});

export { app };
