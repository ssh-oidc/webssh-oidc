<script lang="ts">
// vim:ft=javascript
	import { onMount } from 'svelte';
	import { signIn } from '@auth/sveltekit/client';
	import { page } from '$app/stores';

	import logo from '$lib/assets/webssh-oidc-square.png';
	import MyAlert from '$lib/MyAlert.svelte';
	import MyInputHost from '$lib/MyInputHost.svelte';
	import MySelect from '$lib/MySelect.svelte';
	import MyButton from '$lib/MyButton.svelte';
	import MyProviderOption from '$lib/MyProviderOption.svelte';
	import { isValidHost, hostSchema, resetHost, type Host, type OP } from '$lib/types';
	import { loadOpInfo, loadOps } from '$lib/motley_cue';
	import { errorMessage, uiBlock } from '$lib/stores';
	import { slide } from 'svelte/transition';
	import logger from '$lib/clientLogger';

	export let providers: Record<string, OP>;
	export let config: { mcEndpoint: string; sshInternalHost: { hostname: string; port: number } };
	let advanced: boolean = false;

	// default settings
	let defaultSsh = { ...resetHost };
	let defaultMc = { ...resetHost };
	let defaultOps: string[];
	let defaultMcEndpoint: URL;

	// settings for SSH server
	let sshInternalHost = { ...resetHost };
	let validSsh = false;

	// initial settings for motley-cue
	let mcHost = { ...resetHost };
	let validMc = false;
	let mcEndpoint: URL;

	// selected OIDC provider from drop-down list
	let supportedOps: string[] | undefined;
	let selectedOp: string | undefined = undefined;
	let hasSelectedOp = false;
	let canSubmit = false;

	let filteredOps: string[] | undefined;

	const providerCache = new Map<string, string[]>();

	async function loadOpsWrapper(fetch: typeof window.fetch, endpoint: URL) {
		if (providerCache.has(endpoint.toString())) {
			return providerCache.get(endpoint.toString()) ?? [];
		}

		const OPs = await loadOps(fetch, endpoint);
		providerCache.set(endpoint.toString(), OPs);
		return OPs;
	}

	onMount(async () => {
		try {
			$uiBlock = true;
			// load default settings from environment variables or use sane defaults
			try {
				defaultSsh = hostSchema.parse(config.sshInternalHost);
				sshInternalHost = { ...defaultSsh };
				validSsh = isValidHost(sshInternalHost);
            logger.debug('[LoginComponent] SSH host configured:', JSON.stringify(sshInternalHost));
			} catch (e) {
				logger.error(`Invalid SSH host: ${config.sshInternalHost}`);
			}

			try {
                logger.debug('[LoginComponent] Parsing MC endpoint from config:', config.mcEndpoint);
				defaultMcEndpoint = new URL(config.mcEndpoint);
				// URL API returns empty string for default ports (443 for https, 80 for http)
				// We need to provide the actual port number for the Host schema
				const effectivePort = defaultMcEndpoint.port ||
					(defaultMcEndpoint.protocol === 'https:' ? '443' : '80');
                logger.debug('[LoginComponent]ParsedURL:',{
                    href:defaultMcEndpoint.href,
                    hostname:defaultMcEndpoint.hostname,
                    port:defaultMcEndpoint.port,
                    effectivePort:effectivePort,
                    pathname:defaultMcEndpoint.pathname,
                    protocol:defaultMcEndpoint.protocol
                });
				defaultMc = hostSchema.parse({
					hostname: defaultMcEndpoint.hostname,
					port: effectivePort,
					protocol: defaultMcEndpoint.protocol.substring(0, defaultMcEndpoint.protocol.length - 1)
				});
				mcHost = { ...defaultMc };
				validMc = isValidHost(mcHost);
				// Keep the full URL including pathname for the endpoint
				mcEndpoint = defaultMcEndpoint;
                logger.debug('[LoginComponent]mcEndpoint:', {mcEndpoint: mcEndpoint,});
			} catch (e) {
				logger.error(`Invalid Motley Cue API endpoint: ${config.mcEndpoint}`, e);
			}
            logger.debug('[LoginComponent] Loading OPs from:', mcEndpoint?.toString());

			defaultOps = await loadOpsWrapper(fetch, mcEndpoint);
            logger.debug('[LoginComponent] Loaded OPs:', defaultOps);
			supportedOps = [...defaultOps];
			filteredOps = supportedOps.filter((value: string) => Object.keys(providers).includes(value.replace(/\/+$/, '')));
            logger.debug('[LoginComponent] Filtered OPs:', filteredOps);
			
			// Handle IdP hinting
			handleIdpHint();
		} catch (e) {
			const errorDetail = e instanceof Error ? e.message : String(e);
			logger.error('[LoginComponent] onMount error:', errorDetail);
			logger.error('[LoginComponent] mcEndpoint was:', mcEndpoint?.toString() ?? 'undefined');
			defaultMc = { ...resetHost };
			mcHost = { ...resetHost };
			validMc = false;
			$errorMessage = `Cannot connect to motley-cue server at ${mcEndpoint?.toString() ?? config.mcEndpoint}. Error: ${errorDetail}`;
		} finally {
			$uiBlock = false;
		}
	});

	const clear = () => {
		$errorMessage = '';
		supportedOps = undefined;
		filteredOps = undefined;
		hasSelectedOp = false;
		selectedOp = undefined;
	};

	let timeout: NodeJS.Timeout | undefined = undefined;
	const debouncedReloadOPs = (e: CustomEvent<Host>) => {
		clearTimeout(timeout);
		clear();
		timeout = setTimeout(() => reloadOPs(e), 200);
	};

	/**
	 * Construct a proper URL from host components.
	 * Handles the case where hostname may contain a path (e.g., "example.org/motley_cue")
	 * by separating hostname from path and placing the port correctly.
	 */
	const buildMcEndpointUrl = (host: Host): URL => {
		// Check if hostname contains a path component
		const slashIndex = host.hostname.indexOf('/');
		let hostname: string;
		let pathname: string;

		if (slashIndex !== -1) {
			// Hostname contains a path, split them
			hostname = host.hostname.substring(0, slashIndex);
			pathname = host.hostname.substring(slashIndex);
			// Ensure pathname ends with /
			if (!pathname.endsWith('/')) {
				pathname += '/';
			}
		} else {
			hostname = host.hostname;
			pathname = '/';
		}

		// Construct URL with proper ordering: protocol://hostname:port/path
		const url = new URL(`${host.protocol}://${hostname}:${host.port}${pathname}`);
        logger.debug('[LoginComponent] buildMcEndpointUrl: input hostname =', host.hostname);
        logger.debug('[LoginComponent] buildMcEndpointUrl: parsed hostname =', hostname);
        logger.debug('[LoginComponent] buildMcEndpointUrl: parsed pathname =', pathname);
        logger.debug('[LoginComponent] buildMcEndpointUrl: result =', url.toString());
		return url;
	};

	const reloadOPs = async ({ detail }: CustomEvent<Host>) => {
		mcHost = { ...detail };
        logger.debug('[LoginComponent] reloadOPs: mcHost =', JSON.stringify(mcHost));
		mcEndpoint = buildMcEndpointUrl(mcHost);
        logger.debug('[LoginComponent] reloadOPs: constructed mcEndpoint =', mcEndpoint.toString());
		validMc = false;

		// for the default motley_cue server, use the pre-loaded OPs
		if (JSON.stringify(mcHost) === JSON.stringify(defaultMc)) {
			// Use the original defaultMcEndpoint which preserves the pathname
			mcEndpoint = defaultMcEndpoint;
            logger.debug('[LoginComponent] reloadOPs: using defaultMcEndpoint =', mcEndpoint.toString());
			supportedOps = defaultOps;
			filteredOps = supportedOps.filter((value: string) => Object.keys(providers).includes(value.replace(/\/+$/, '')));
			validMc = true;
			return;
		}

		// for other motley_cue servers, load the OPs from the server
		try {
			$uiBlock = true;
            logger.debug('[LoginComponent] reloadOPs: fetching OPs from', mcEndpoint.toString());
			supportedOps = await loadOpsWrapper(fetch, mcEndpoint);
			if (!supportedOps || !supportedOps.length) {
				throw new Error('No supported OPs');
			}
			filteredOps = supportedOps.filter((value: string) => Object.keys(providers).includes(value.replace(/\/+$/, '')));
			validMc = true;
		} catch (e) {
			supportedOps = [];
			const errorDetail = e instanceof Error ? e.message : String(e);
			logger.error('[LoginComponent] reloadOPs failed:', errorDetail);
			logger.error('[LoginComponent] Attempted URL:', mcEndpoint.toString());
			$errorMessage = `Failed to load OIDC providers from motley_cue server at ${mcEndpoint.toString()}. Error: ${errorDetail}`;
		} finally {
			$uiBlock = false;
		}
	};
	const resetOPs = () => {
		supportedOps = [];
		filteredOps = [];
		mcHost = { ...resetHost };
		validMc = false;
		hasSelectedOp = false;
		selectedOp = undefined;
	};

	$: canSubmit = validSsh && validMc && hasSelectedOp;

	function isKeyOf<T>(key: string | number | symbol, obj: T): key is keyof T {
		return obj && typeof obj == 'object' && key in obj;
	}

	function handleIdpHint() {
		const idpHint = $page.url.searchParams.get('idphint');
		
		if (!idpHint) {
			return;
		}
		
		logger.info(`IdP hint received: ${idpHint}`);
		
		// Check if the hint matches any of our supported OPs
		if (!filteredOps || !filteredOps.includes(idpHint)) {
            console.log(`IdP hint "${idpHint}" not found in supported OPs:`, filteredOps);
			return;
		}
		
		// Check if the hinted OP is a known provider
		if (!isKeyOf(idpHint, providers)) {
			logger.info(`IdP hint "${idpHint}" not found in providers configuration`);
			return;
		}
		
		logger.info(`Valid IdP hint found: ${idpHint}, auto-selecting and logging in`);
		
		// Auto-select the OP
		selectedOp = idpHint;
		hasSelectedOp = true;
		
		// Auto-trigger login after a short delay to ensure UI state is updated
		setTimeout(() => {
			if (canSubmit) {
				logger.info('Auto-triggering login due to IdP hint');
				handleLogin();
			}
		}, 100);
	}

	const handleLogin = async () => {
		try {
			$uiBlock = true;
            logger.debug('[LoginComponent] handleLogin: starting login flow');
            logger.debug('[LoginComponent] handleLogin: selectedOp =', selectedOp);
            logger.debug('[LoginComponent] handleLogin: mcEndpoint =', mcEndpoint.toString());
            logger.debug('[LoginComponent] handleLogin: sshInternalHost =', JSON.stringify(sshInternalHost));

			const normalizedOp = selectedOp?.replace(/\/+$/, '');
			if (!normalizedOp || !isKeyOf(normalizedOp, providers)) {
				throw new Error('Invalid OIDC provider');
			}

			let op = providers[normalizedOp];
            logger.debug('[LoginComponent] handleLogin: fetching OP info for', selectedOp);
			let opInfo = await loadOpInfo(fetch, mcEndpoint, selectedOp);
            logger.debug('[LoginComponent] handleLogin: opInfo =', JSON.stringify(opInfo));
			let callbackUrl =
				'/redir' +
				'?mcEndpoint=' +
				encodeURIComponent(mcEndpoint.toString()) +
				'&sshHostname=' +
				encodeURIComponent(sshInternalHost.hostname) +
				'&sshPort=' +
				sshInternalHost.port.toString();
            logger.debug('[LoginComponent] handleLogin: callbackUrl =', callbackUrl);
			await signIn(op.id, { callbackUrl: callbackUrl }, { scope: opInfo.scopes.join(' ') });
		} catch (e) {
			$uiBlock = false;
			const errorDetail = e instanceof Error ? e.message : String(e);
			logger.error('[LoginComponent] handleLogin failed:', errorDetail);
			logger.error('[LoginComponent] handleLogin: mcEndpoint was', mcEndpoint.toString());
			$errorMessage = `Failed to login: ${errorDetail}`;
		}
	};
</script>

<div class="bg-white dark:bg-gray-800 -mt-64 rounded-lg shadow w-full max-w-[500px] mx-auto p-10">
	<div>
		<img class="mx-auto h-12 w-auto" src={logo} alt="webssh-oidc logo" />
		<h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-mc-gray dark:text-gray-200">SSH with OIDC</h2>
	</div>
	{#if $errorMessage}
		<MyAlert />
	{/if}
	<form class="mt-8 space-y-6" on:submit|preventDefault={handleLogin}>
		<input type="hidden" name="remember" value="true" />
		<div class="-space-y-px rounded-md">
			<div>
				<!-- <label for="op" class="block font-medium text-mc-gray pt-4 pb-2 pl-1"
					>OIDC identity provider</label
				> -->
				<div class="text-sm pt-4 pb-2">
					<MySelect
						name="op"
						values={filteredOps}
						descriptionTexts={{
							loading: 'Loading...',
							novals: 'No supported OPs',
							choose: 'Select identity provider'
						}}
						value={selectedOp}
						disabled={$uiBlock || !filteredOps || !filteredOps.length}
						on:select={({ detail }) => {
							selectedOp = detail;
							hasSelectedOp = true;
						}}
					>
						<div slot="selectedValue" let:value>
							<MyProviderOption provider_issuer={value || ''} />
						</div>
						<div slot="option" let:value>
							<MyProviderOption provider_issuer={value} />
						</div>
					</MySelect>
				</div>
			</div>
			<div class="flex items-center pt-2 pb-1 px-1">
				<input
					id="advanced-settings"
					type="checkbox"
					checked={advanced}
					on:change={() => (advanced = !advanced)}
					class="w-4 h-4 bg-mc-gray-100 rounded-md"
				/>
				<label
					for="advanced-settings"
					class="ms-2 text-sm font-medium text-mc-gray dark:text-mc-gray-200"
					>Show advanced settings</label
				>
			</div>
			{#if advanced}
				<div in:slide|global={{ duration: 300 }} out:slide|global={{ duration: 300 }}>
					<MyInputHost
						title="motley_cue"
						host={mcHost}
						defaultHost={defaultMc}
						showProtocol={true}
						on:change={debouncedReloadOPs}
						disabled={$uiBlock}
					/>
					<MyInputHost
						title="SSH"
						host={sshInternalHost}
						defaultHost={defaultSsh}
						disabled={$uiBlock}
						on:change={({ detail }) => {
							sshInternalHost = { ...detail };
							validSsh = true;
						}}
					/>
				</div>
			{/if}
		</div>

		<div>
			<MyButton disabled={!canSubmit || $uiBlock}>
				<span class="absolute inset-y-0 left-0 flex items-center pl-3">
					<!-- Heroicon name: mini/lock-closed -->
					<svg
						class="h-5 w-5 text-mc-blue-400 group-hover:text-mc-blue-300"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
							clip-rule="evenodd"
						/>
					</svg>
				</span>
				Log in
			</MyButton>
		</div>
	</form>
</div>
