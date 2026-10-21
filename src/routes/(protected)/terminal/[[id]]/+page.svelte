<script lang="ts">
	import TerminalTab from './TerminalTab.svelte';
	import Icon from '@iconify/svelte';

	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import { signOut } from '@auth/sveltekit/client';
	import { errorMessage, uiBlock, darkMode } from '$lib/stores';
	import TerminalComponent from '$lib/TerminalComponent.svelte';
	import HelpModal from '$lib/HelpModal.svelte';
	import ProfileModal from '$lib/ProfileModal.svelte';

	import type { APIEndpoints, APIResponses, APIParams } from '../../api/terminal/[action]/+server';
	import type { TerminalSessionInfo } from '$lib/server/sessions';

	type JSONValue = string | number | boolean | JSONObject | JSONArray | null;
	type JSONObject = { [member: string]: JSONValue };
	type JSONArray = JSONValue[];

	async function APIFetch<T extends APIEndpoints>(s: T, ...args: APIParams[T]) {
		const response = await fetch(`/api/terminal/${s}/`, {
			method: 'POST',
			body: JSON.stringify(args),
			headers: {
				'Content-Type': 'application/json'
			}
		});

		const json = await response.json();
		const fetchData = json.data as APIResponses[typeof s];

		return fetchData;
	}

	let terminalOrder: string[] = [];

	export let data: PageData;

	const loginParams = {
		wsUrl: data.wsUrl,
		sshInternalHost: {
			hostname: data.userSession.sshHostname,
			port: data.userSession.sshPort
		},
		sshUser: data.username,
		accessToken: data.accessToken,
		oinitPrivateKey: data.oinitPrivateKey,
		oinitCertificate: data.oinitCertificate
	};

	let terminals = data.userSession.terminals;
	let credentialsDrawerOpen = true;
	let copiedId: string | null = null;
	let drawerAutoCloseTimer: ReturnType<typeof setTimeout> | null = null;
	let helpModalOpen = false;
	let profileModalOpen = false;

	const userName = data.session?.user?.name ?? data.session?.user?.email ?? data.session?.user?.id ?? 'User';

	const sshPortFlag = loginParams.sshInternalHost.port === 22 ? '' : ` -p ${loginParams.sshInternalHost.port}`;

	const helpLoginParams = {
		accessToken: data.accessToken,
		mcEndpoint: data.userSession.mcEndpoint,
		issuer: String(data.session?.profile?.iss ?? ''),
		sshInternalHost: {
			hostname: data.userSession.sshHostname,
			port: data.userSession.sshPort
		},
		sshUser: data.username
	};

	function resetDrawerAutoClose() {
		if (drawerAutoCloseTimer) clearTimeout(drawerAutoCloseTimer);
		drawerAutoCloseTimer = setTimeout(() => { credentialsDrawerOpen = false; }, 10000);
	}

	function downloadFile(content: string, filename: string) {
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function downloadSshCredentials() {
		const hostname = data.sshHostname;
		downloadFile(data.oinitPrivateKey, `id_ed25519_${hostname}`);
		setTimeout(() => {
			downloadFile(data.oinitCertificate, `id_ed25519_${hostname}-cert.pub`);
		}, 100);
	}

	function copyToClipboard(content: string, id: string) {
		navigator.clipboard.writeText(content).then(() => {
			copiedId = id;
			setTimeout(() => { copiedId = null; }, 1000);
		});
	}

	onMount(async () => {
		if (!data.username || data.username === '') {
			errorMessage.set('No ssh username found.');
			console.error('No ssh username found. Signing out.');
			await signOut();
			$uiBlock = false;
		}

		if (data.userSession.terminals.length === 0) {
			addTerminal();
		} else {
			terminalOrder = data.userSession.terminals.map((t) => t.id);
		}

		$uiBlock = false;
		resetDrawerAutoClose();
	});

	async function addTerminal() {
		const apiResponse = await APIFetch('create', { name: `Terminal ${terminals.length}` });

		if (!apiResponse.success) {
			errorMessage.set('Failed to create terminal');
			return;
		}

		const newTerm = apiResponse.data;

		terminals = [...terminals, newTerm];
		terminalOrder = [...terminalOrder, newTerm.id];
	}

	function focusTerminal(tinfo: TerminalSessionInfo) {
		const index = terminals.findIndex((t) => t.id === tinfo.id);
		const termDiv = document.querySelector(`#terminal${index} textarea`) as HTMLTextAreaElement;
		if (termDiv) termDiv.focus();
		else console.error('Could not find terminal div');
	}

	async function removeTerminal(tinfo: TerminalSessionInfo) {
		const apiResponse = await APIFetch('delete', { id: tinfo.id });

		if (!apiResponse.success) {
			errorMessage.set('Failed to delete terminal');
			return;
		}

		terminals = terminals.filter((t) => t.id !== tinfo.id);
		terminalOrder = terminalOrder.filter((id) => id !== tinfo.id);

		if (terminals.length === 0) await signOut();
		else focusTerminal(terminals[terminals.length - 1]);
	}

	function shiftToFront(event: CustomEvent<TerminalSessionInfo>) {
		const tinfo = event.detail;
		terminalOrder = [...terminalOrder.filter((id) => id !== tinfo.id), tinfo.id];
		focusTerminal(tinfo);
	}

	function confirmUnload(event: BeforeUnloadEvent) {
		if (terminals.length > 0) {
			event.preventDefault();
			const msg = 'You have active terminals. Are you sure you want to leave?';
			event.returnValue = msg;
			return msg;
		}
	}
</script>

<!-- <svelte:window on:beforeunload={confirmUnload} /> -->

{#if data.username === ''}
	<p>Could not get SSH username</p>
{:else}
	<div class="grid grid-rows-[auto,1fr,auto] h-[calc(100vh-155px)]">
		<div class="flex flex-row px-2 gap-0.5 flex-wrap dark:text-gray-300">
			{#each terminals as tinfo, i}
				<TerminalTab
					tabInfo={tinfo}
					isActive={tinfo.id == terminalOrder[terminalOrder.length - 1]}
					on:clicked={shiftToFront}
					on:closed={() => removeTerminal(tinfo)}
				/>
			{/each}
			<button
				class="px-2 hover:text-mc-orange leading-none"
				on:click={addTerminal}
				hidden={terminals.length == 0}
				><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="M7.007 12a.75.75 0 0 1 .75-.75h3.493V7.757a.75.75 0 0 1 1.5 0v3.493h3.493a.75.75 0 1 1 0 1.5H12.75v3.493a.75.75 0 0 1-1.5 0V12.75H7.757a.75.75 0 0 1-.75-.75"
					/><path
						fill="currentColor"
						fill-rule="evenodd"
						d="M7.317 3.769a42.502 42.502 0 0 1 9.366 0c1.827.204 3.302 1.643 3.516 3.48c.37 3.157.37 6.346 0 9.503c-.215 1.837-1.69 3.275-3.516 3.48a42.5 42.5 0 0 1-9.366 0c-1.827-.205-3.302-1.643-3.516-3.48a40.903 40.903 0 0 1 0-9.503c.214-1.837 1.69-3.276 3.516-3.48m9.2 1.49a41.001 41.001 0 0 0-9.034 0A2.486 2.486 0 0 0 5.29 7.424a39.402 39.402 0 0 0 0 9.154a2.486 2.486 0 0 0 2.193 2.164c2.977.332 6.057.332 9.034 0a2.486 2.486 0 0 0 2.192-2.164a39.401 39.401 0 0 0 0-9.154a2.486 2.486 0 0 0-2.192-2.163"
						clip-rule="evenodd"
					/></svg
				></button
			>
			<button
				class="px-2 hover:text-mc-blue-500 leading-none ml-auto"
				on:click={() => profileModalOpen = true}
				title="My Profile"
			>
				<Icon icon="mdi:account-circle-outline" class="text-2xl" />
			</button>
			<button
				class="px-2 hover:text-mc-blue-500 leading-none"
				on:click={() => helpModalOpen = true}
				title="Help - Commandline Login"
			>
				<Icon icon="mdi:help-circle-outline" class="text-2xl" />
			</button>
			<button
				class="px-2 hover:text-mc-blue-500 leading-none"
				on:click={() => darkMode.update(v => !v)}
				title={$darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
			>
				<Icon icon={$darkMode ? 'mdi:weather-sunny' : 'mdi:weather-night'} class="text-2xl" />
			</button>
		</div>
		<div class="grid grid-cols-1 grid-rows-1 overflow-hidden">
			{#each terminals as tinfo, i}
				<div
					id={`terminal${i}`}
					class="inset-0 terminal"
					style="z-index: {terminalOrder.indexOf(tinfo.id)};"
				>
					<TerminalComponent
						sessionInfo={tinfo}
						{loginParams}
						on:closed={() => removeTerminal(tinfo)}
					/>
				</div>
			{/each}
		</div>

		<!-- Credentials Drawer -->
		{#if data.oinitPrivateKey && data.oinitCertificate}
			<div class="border-t border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
				<button
					type="button"
					on:click={() => credentialsDrawerOpen = !credentialsDrawerOpen}
					class="flex items-center justify-between w-full text-base font-semibold text-mc-gray dark:text-gray-200 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
				>
					<span class="text-mc-orange">Download Access Token &nbsp;&nbsp;&nbsp;&nbsp; |&nbsp;&nbsp;&nbsp;&nbsp; Download SSH Certificate Credentials</span>
					<Icon icon={credentialsDrawerOpen ? 'mdi:chevron-down' : 'mdi:chevron-up'} class="text-base" />
				</button>

				{#if credentialsDrawerOpen}
					<div class="px-4 py-3 space-y-3 bg-gray-50 dark:bg-gray-800">

						<div class="flex gap-6">
							<!-- Access Token -->
							<div class="flex items-center gap-2">
								<button
									on:click={() => downloadFile(loginParams.accessToken, 'bt_u1000')}
									class="bg-mc-blue-500 hover:bg-mc-blue-600 text-white font-semibold py-2 px-4 rounded whitespace-nowrap"
								>
									Download Access Token
								</button>
								<span class="text-mc-gray dark:text-gray-400 text-xs whitespace-nowrap">
									Save to: <span class="font-mono">/tmp/bt_u$UID</span>
								</span>
								<button
									on:click={() => copyToClipboard(loginParams.accessToken, 'token')}
									class="flex items-center gap-1 text-mc-gray dark:text-gray-300 hover:text-mc-blue-500"
								>
									<span class="text-sm">Access Token</span>
									<Icon icon={copiedId === 'token' ? 'mdi:check' : 'mdi:content-copy'} class="text-xl" />
								</button>
							</div>

							<!-- SSH Credentials (Private Key + Certificate) -->
							<div class="flex items-center gap-2">
								<button
									on:click={downloadSshCredentials}
									class="bg-mc-blue-500 hover:bg-mc-blue-600 text-white font-semibold py-2 px-4 rounded whitespace-nowrap"
								>
									Download SSH Credentials (Key + Cert)
								</button>
								<span class="text-mc-gray dark:text-gray-400 text-xs whitespace-nowrap">
									Save both to: <span class="font-mono">~/.ssh/</span><br/>
									<span class="font-mono">chmod 600 ~/.ssh/id_ed25519_{data.sshHostname}</span>

								</span>
								<button
									on:click={() => copyToClipboard(data.oinitPrivateKey, 'key')}
									class="flex items-center gap-1 text-mc-gray dark:text-gray-300 hover:text-mc-blue-500"
								>
									<span class="text-sm">Private Key</span>
									<Icon icon={copiedId === 'key' ? 'mdi:check' : 'mdi:content-copy'} class="text-xl" />
								</button>
								<button
									on:click={() => copyToClipboard(data.oinitCertificate, 'cert')}
									class="flex items-center gap-1 text-mc-gray dark:text-gray-300 hover:text-mc-blue-500"
								>
									<span class="text-sm">Certificate</span>
									<Icon icon={copiedId === 'cert' ? 'mdi:check' : 'mdi:content-copy'} class="text-xl" />
								</button>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<span class="text-mc-gray dark:text-gray-300 text-sm font-medium">SSH command:</span>
							<code class="font-mono text-sm bg-gray-200 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded">ssh -i ~/.ssh/id_ed25519_{data.sshHostname}{sshPortFlag} oinit@{data.sshHostname}</code>
							<button
								on:click={() => copyToClipboard(`ssh -i ~/.ssh/id_ed25519_${data.sshHostname}${sshPortFlag} oinit@${data.sshHostname}`, 'sshCmd')}
								class="text-mc-gray dark:text-gray-300 hover:text-mc-blue-500"
							>
								<Icon icon={copiedId === 'sshCmd' ? 'mdi:check' : 'mdi:content-copy'} class="text-xl" />
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<HelpModal
	bind:open={helpModalOpen}
	loginParams={helpLoginParams}
	oinitPrivateKey={data.oinitPrivateKey}
	oinitCertificate={data.oinitCertificate}
/>

<ProfileModal
	bind:open={profileModalOpen}
	userName={userName}
	sshUser={data.username}
	issuer={String(data.session?.profile?.iss ?? '')}
	profile={data.session?.profile}
	userinfo={data.session?.userinfo}
/>

<style lang="postcss">
	.terminal {
		grid-area: 1 / 1 / 2 / 2;
	}
</style>
