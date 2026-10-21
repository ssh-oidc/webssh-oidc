<script lang="ts">
    // vim: ft=javascript
	import '@xterm/xterm/css/xterm.css';
	import { createEventDispatcher, onMount } from 'svelte';
	import { resize } from 'svelte-resize-observer-action';
	import { errorMessage } from '$lib/stores';
	import type { Terminal } from '$lib/terminal';
	import { signOut } from '@auth/sveltekit/client';
	import type { TerminalSessionInfo } from '$lib/server/sessions';
	import logger from '$lib/clientLogger';

	export let sessionInfo: TerminalSessionInfo;
	export let loginParams: {
		wsUrl: string;
		sshInternalHost: { hostname: string; port: number };
		sshUser: string;
		accessToken: string;
		oinitPrivateKey?: string;
		oinitCertificate?: string;
	};

	let termDiv: HTMLElement;
	let term: Terminal | undefined;
	let width: number;
	let height: number;

	function onResize(entry: ResizeObserverEntry) {
		width = entry.contentRect.width;
		height = entry.contentRect.height;
		// console.log(
		// 	'resize detected.',
		// 	entry,
		// 	term && term.proposeDimensions(),
		// 	width,
		// 	height,
		// 	term && term.currentDimensions()
		// );
		const current = term?.currentDimensions() ?? { cols: 80, rows: 24 };
		const proposed = term?.proposeDimensions() ?? { cols: 80, rows: 24 };

		if (term && (current.cols !== proposed.cols || current.rows !== proposed.rows)) {
			term.resize(proposed);
		}

		// term && term.resize();
		// }
	}

	const dispatch = createEventDispatcher<{ closed: TerminalSessionInfo }>();

	function closeTerminal() {
		dispatch('closed', sessionInfo);
	}

	onMount(async () => {
        logger.debug('[TerminalComponent] onMount: loginParams =', JSON.stringify(loginParams, null, 2));
		if (!loginParams || !loginParams.accessToken) {
			$errorMessage = 'Please log in again.';
			await signOut();
		}

		if (!loginParams.sshUser) {
			logger.error('[TerminalComponent] No SSH username provided!');
			$errorMessage = 'No SSH username - motley_cue connection may have failed.';
			return;
		}

		const libterm = await import('$lib/terminal');
		const wsConnectUrl = new URL(loginParams.wsUrl + '/connect');
		wsConnectUrl.searchParams.set('sshHostname', loginParams.sshInternalHost.hostname);
		wsConnectUrl.searchParams.set('sshPort', loginParams.sshInternalHost.port.toString());
		wsConnectUrl.searchParams.set('username', loginParams.sshUser);
		// Pass oinit credentials if available (base64 encoded)
		if (loginParams.oinitPrivateKey && loginParams.oinitCertificate) {
			wsConnectUrl.searchParams.set('oinitPrivateKey', btoa(loginParams.oinitPrivateKey));
			wsConnectUrl.searchParams.set('oinitCertificate', btoa(loginParams.oinitCertificate));
		}
        logger.debug('[TerminalComponent] WebSocket URL:', wsConnectUrl.toString());
        logger.debug('[TerminalComponent] Creating WebSocket connection...');

		if (termDiv) {
			term = new libterm.Terminal(termDiv);
			// connect to websocket and timeout after a few seconds
			let ws: WebSocket;
			try {
				ws = new WebSocket(wsConnectUrl, loginParams.accessToken);
                logger.debug('[TerminalComponent] WebSocket created, readyState:', ws.readyState);
			} catch (err) {
				logger.error('[TerminalComponent] WebSocket creation failed:', err);
				$errorMessage = `WebSocket creation failed: ${err}`;
				return;
			}

			let timeout: NodeJS.Timeout | undefined = undefined;
			ws.onopen = () => {
                logger.debug('[TerminalComponent] WebSocket opened successfully');
				if (timeout) clearTimeout(timeout);
			};
			ws.onclose = (ev: CloseEvent) => {
				if (ev.code !== 1000) {
					// 1000 = normal close (https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
					$errorMessage = ev.reason || `WebSocket closed with code ${ev.code}`;
				}
				setTimeout(async () => {
					// await signOut();
					closeTerminal();
				}, 500);
			};
			ws.onerror = async (ev: Event) => {
				logger.error('[TerminalComponent] WebSocket error:', ev);
				$errorMessage = 'Could not connect to SSH server.';
				// await signOut();
				closeTerminal();
			};

			timeout = setTimeout(async () => {
				$errorMessage = 'Could not connect to SSH server.';
				// await signOut();
				closeTerminal();
			}, 3000);

			term.initSocket(ws);
		}
	});

	function resizeAction(elem: HTMLElement, callback: (entry: ResizeObserverEntry) => void) {
		const observer = new ResizeObserver((entries) => {
			for (let entry of entries) {
				callback(entry);
			}
		});

		observer.observe(elem);

		return {
			destroy() {
				observer.unobserve(elem);
				observer.disconnect();
			}
		};
	}
</script>

<div
	class="rounded overflow-hidden bg-black shadow-md shadow-neutral-400 p-2 h-full"
	bind:this={termDiv}
	use:resizeAction={onResize}
/>

<style lang="postcss">
	:global(.xterm .xterm-viewport) {
		/* see : https://github.com/xtermjs/xterm.js/issues/3564#issuecomment-1004417440 */
		width: initial !important;
		height: initial !important;
		overflow-y: hidden !important;
	}

	:global(.xterm .xterm-scroll-area) {
		visibility: hidden;
	}
</style>
