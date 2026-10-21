<script lang="ts">
	import Icon from '@iconify/svelte';
	import MyCodeArea from '$lib/MyCodeArea.svelte';
	import { createEventDispatcher } from 'svelte';

	export let open = false;
	export let loginParams: {
		accessToken: string;
		mcEndpoint: string;
		issuer: string;
		sshInternalHost: { hostname: string; port: number };
		sshUser: string;
	};
	export let oinitPrivateKey: string | undefined = undefined;
	export let oinitCertificate: string | undefined = undefined;

	const dispatch = createEventDispatcher<{ close: void }>();

	function close() {
		open = false;
		dispatch('close');
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

	const sshCmd = `ssh -p ${loginParams.sshInternalHost.port} ${loginParams.sshUser}@${loginParams.sshInternalHost.hostname}`;
	const mccliCmd = `mccli --mc-endpoint ${loginParams.mcEndpoint
		.toString()
		.replace(/\/$/, '')} --token ${loginParams.accessToken} ssh -p ${
		loginParams.sshInternalHost.port
	} ${loginParams.sshInternalHost.hostname}`;
	const mccliCmdOidcAgent = `mccli --mc-endpoint ${loginParams.mcEndpoint
		.toString()
		.replace(/\/$/, '')} --issuer ${loginParams.issuer} ssh -p ${
		loginParams.sshInternalHost.port
	} ${loginParams.sshInternalHost.hostname}`;

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black bg-opacity-50 z-50"
		on:click={close}
		on:keydown={handleKeydown}
		role="button"
		tabindex="-1"
	/>

	<!-- Modal -->
	<div class="fixed inset-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
		<!-- Header -->
		<div class="flex items-center justify-between px-6 py-3 border-b dark:border-gray-600">
			<h1 class="text-xl font-semibold text-mc-gray dark:text-gray-200">Commandline Login</h1>
			<button on:click={close} class="text-mc-gray dark:text-gray-300 hover:text-mc-blue-500">
				<Icon icon="mdi:close" class="text-2xl" />
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto px-6 py-4">
			<div class="flex flex-col gap-4">
				<p class="text-mc-gray dark:text-gray-300">
					The alternative to this web SSH login is to use the command line. There are several options to
					login to an SSH server with OpenId Connect using the commandline:
				</p>

				<h2 class="text-xl font-semibold text-mc-gray dark:text-gray-300">1. ssh certificates</h2>

				<p class="text-mc-gray dark:text-gray-300">
					This tool uses SSH certificates signed by a CA instead of
					traditional SSH keys. This provides short-lived credentials that are automatically issued based on
					your OIDC identity.
				</p>

				{#if oinitPrivateKey && oinitCertificate}
					<MyCodeArea
						label="SSH command with certificate:"
						id="modalOinitSshCmd"
						open={true}
						value={`ssh -i ~/.ssh/id_ed25519_${loginParams.sshInternalHost.hostname} -p ${loginParams.sshInternalHost.port} oinit@${loginParams.sshInternalHost.hostname}`}
					/>

					<!-- Access Token -->
					<div class="flex items-center gap-4">
						<button
							on:click={() => downloadFile(loginParams.accessToken, 'bt_u1000')}
							class="bg-mc-blue-500 hover:bg-mc-blue-600 text-white font-semibold py-2 px-4 rounded whitespace-nowrap"
						>
							Download Access Token
						</button>
						<span class="text-mc-gray text-xs">
							Save to: <span class="font-mono">/tmp/bt_u$UID</span>
						</span>
						<div class="flex-1">
							<MyCodeArea label="Access Token:" id="modalAccessToken" value={loginParams.accessToken} />
						</div>
					</div>

					<!-- Private Key -->
					<div class="flex items-center gap-4">
						<button
							on:click={() => downloadFile(oinitPrivateKey, `id_ed25519_${loginParams.sshInternalHost.hostname}`)}
							class="bg-mc-blue-500 hover:bg-mc-blue-600 text-white font-semibold py-2 px-4 rounded whitespace-nowrap"
						>
							Download Private Key
						</button>
						<span class="text-mc-gray text-xs">
							Save to: <span class="font-mono">~/.ssh/id_ed25519</span><br/>
							<span class="font-mono">chmod 600 ~/.ssh/id_ed25519</span>
						</span>
						<div class="flex-1">
							<MyCodeArea label="Private Key:" id="modalOinitPrivateKey" value={oinitPrivateKey} />
						</div>
					</div>

					<!-- Certificate -->
					<div class="flex items-center gap-4">
						<button
							on:click={() => downloadFile(oinitCertificate, `id_ed25519_${loginParams.sshInternalHost.hostname}-cert.pub`)}
							class="bg-mc-blue-500 hover:bg-mc-blue-600 text-white font-semibold py-2 px-4 rounded whitespace-nowrap"
						>
							Download Certificate
						</button>
						<span class="text-mc-gray text-xs">
							Save to: <span class="font-mono">~/.ssh/id_ed25519-cert.pub</span>
						</span>
						<div class="flex-1">
							<MyCodeArea label="Certificate:" id="modalOinitCertificate" value={oinitCertificate} />
						</div>
					</div>
				{:else}
					<p class="text-mc-gray text-sm italic">
						oinit is not configured for this server.
					</p>
				{/if}

				<h2 class="text-xl font-semibold text-mc-gray dark:text-gray-300">2. oinit</h2>

				<p class="text-mc-gray dark:text-gray-300">For easier access from the commandline, we
				recommend to install the tools <span class="font-mono">oinit</span>
				and <span class="font-mono">oidc-agent</span>:</p>
				<ul class="list-disc list-inside text-mc-gray dark:text-gray-300">
					<li>
						Install the corresponding package repository for your linux
						distribution. Details at:
						<a
							href="https://repo.data.kit.edu"
							target="_blank"
							rel="noopener noreferrer"
							class="text-mc-blue-500 underline"
						>
							https://repo.data.kit.edu
						</a>
					</li>
					<li>
						Install packages:<br/>
						&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="font-mono">yum -y install oinit oidc-agent</span><br/>
						&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="font-mono">apt -y install oinit oidc-agent</span>
					</li>
					<li>
					Log in:
					<MyCodeArea
						label="SSH commands with oinit:"
						id="modalOinitSshCmd2"
						open={true}
						value={`oinit add ${loginParams.sshInternalHost.hostname}       # Tell oinit that ${loginParams.sshInternalHost.hostname} is under oinit control (only needed once)
ssh -p ${loginParams.sshInternalHost.port} ${loginParams.sshInternalHost.hostname}`}
					/>
					</li>
					<li>
						Learn more at
						<a
							href="https://ssh-oidc-doc.data.kit.edu"
							target="_blank"
							rel="noopener noreferrer"
							class="text-mc-blue-500 underline"
						>
							https://ssh-oidc-doc.data.kit.edu
						</a>
					</li>
				</ul>

				<hr/>
				<h1 class="text-2xl font-semibold text-mc-gray dark:text-gray-300">Resources</h1>
				<p class="text-mc-gray dark:text-gray-300">Here are some resources to help you get started with SSH-OIDC.</p>
				<ul class="list-disc list-inside text-mc-gray dark:text-gray-300">
					<li>
						The documentation of ssh-oidc
						<a
							href="https://ssh-oidc-doc.data.kit.edu"
							target="_blank"
							rel="noopener noreferrer"
							class="text-mc-blue-500 underline"
						>
							ssh-oidc-doc
						</a>
					</li>
					<li>
						The web client for ssh:
						<a
							href="https://github.com/dianagudu/webssh-oidc"
							target="_blank"
							rel="noopener noreferrer"
							class="text-mc-blue-500 underline"
						>
							webssh-oidc
						</a>
					</li>
					<li>
						The server-side component for identity mapping and account management:
						<a
							href="https://motley-cue.readthedocs.io/"
							target="_blank"
							rel="noopener noreferrer"
							class="text-mc-blue-500 underline"
						>
							motley-cue
						</a>
					</li>
					<li>
						The client-side wrapper for SSH with OIDC:
						<a
							href="https://mccli.readthedocs.io/"
							target="_blank"
							rel="noopener noreferrer"
							class="text-mc-blue-500 underline"
						>
							mccli
						</a>
					</li>
					<li>
						The client-side tool for managing OIDC tokens:
						<a
							href="https://indigo-dc.gitbook.io/oidc-agent"
							target="_blank"
							rel="noopener noreferrer"
							class="text-mc-blue-500 underline"
						>
							oidc-agent
						</a>
					</li>
				</ul>
			</div>
		</div>
	</div>
{/if}
