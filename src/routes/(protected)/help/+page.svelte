<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { errorMessage, uiBlock } from '$lib/stores';
	import MyCodeArea from '$lib/MyCodeArea.svelte';
	import { signOut } from '@auth/sveltekit/client';

	export let data: PageData;

	function downloadFile(content: string, filename: string) {
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	const loginParams = {
		user: data.session?.user.name ?? data.session?.user.email ?? data.session?.user.id ?? 'User',
		accessToken: data.accessToken,
		mcEndpoint: data.userSession.mcEndpoint,
		issuer: data.session?.profile.iss,
		sshInternalHost: {
			hostname: data.userSession.sshHostname,
			port: data.userSession.sshPort
		},
		sshUser: data.username
	};

	const sshCmd = `ssh -p ${loginParams.sshInternalHost.port} ${loginParams.sshUser}@${loginParams.sshInternalHost.hostname}`;
	const mccliCmd = `mccli --mc-endpoint ${loginParams.mcEndpoint
		.toString()
		.replace(/\/$/, '')} --token ${loginParams.accessToken} ssh -p ${
		loginParams.sshInternalHost.port
	} ${loginParams.sshInternalHost.hostname}`;

	onMount(async () => {
		if (!data.username) {
			errorMessage.set('No ssh username found.');
			console.error('No ssh username found. Signing out.');
			await signOut();
			$uiBlock = false;
		}
		$uiBlock = false;
		console.log('loginParams:', loginParams);
		console.log('sshCmd:', sshCmd);
		console.log('mccliCmd:', mccliCmd);
	});
</script>

<div class="flex flex-col gap-4 h-fit">
	<h1 class="text-2xl font-semibold text-mc-gray dark:text-gray-300">Commandline Login</h1>
	<p class="text-mc-gray dark:text-gray-300">
		The alternative to this web SSH login is to use the command line. There are several options to
		login to an SSH server with OpenId Connect using the commandline:
	</p>

	<h2 class="text-xl font-semibold text-mc-gray dark:text-gray-300">1. ssh certificates</h2>

	<p class="text-mc-gray dark:text-gray-300">
		This tool uses SSH certificates signed by a CA instead of traditional SSH keys. This provides
		short-lived credentials that are automatically issued based on your OIDC identity.
	</p>

	{#if data.oinitPrivateKey && data.oinitCertificate}
		<MyCodeArea
			label="SSH command with certificate:"
			id="oinitSshCmd"
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
				<MyCodeArea label="Access Token:" id="accessToken" value={data.accessToken} />
			</div>
		</div>

		<!-- Private Key -->
		<div class="flex items-center gap-4">
			<button
				on:click={() =>
					downloadFile(data.oinitPrivateKey!, `id_ed25519_${loginParams.sshInternalHost.hostname}`)}
				class="bg-mc-blue-500 hover:bg-mc-blue-600 text-white font-semibold py-2 px-4 rounded whitespace-nowrap"
			>
				Download Private Key
			</button>
			<span class="text-mc-gray text-xs">
				Save to: <span class="font-mono">~/.ssh/id_ed25519</span><br />
				<span class="font-mono">chmod 600 ~/.ssh/id_ed25519</span>
			</span>
			<div class="flex-1">
				<MyCodeArea label="Private Key:" id="oinitPrivateKey" value={data.oinitPrivateKey} />
			</div>
		</div>

		<!-- Certificate -->
		<div class="flex items-center gap-4">
			<button
				on:click={() =>
					downloadFile(
						data.oinitCertificate!,
						`id_ed25519_${loginParams.sshInternalHost.hostname}-cert.pub`
					)}
				class="bg-mc-blue-500 hover:bg-mc-blue-600 text-white font-semibold py-2 px-4 rounded whitespace-nowrap"
			>
				Download Certificate
			</button>
			<span class="text-mc-gray text-xs">
				Save to: <span class="font-mono">~/.ssh/id_ed25519-cert.pub</span>
			</span>
			<div class="flex-1">
				<MyCodeArea label="Certificate:" id="oinitCertificate" value={data.oinitCertificate} />
			</div>
		</div>
	{:else}
		<p class="text-mc-gray text-sm italic">oinit is not configured for this server.</p>
	{/if}

	<h2 class="text-xl font-semibold text-mc-gray dark:text-gray-300">2. oinit</h2>

	<p class="text-mc-gray dark:text-gray-300">
		For easier access from the commandline, we recommend to install the tools <span
			class="font-mono">oinit</span
		>
		and <span class="font-mono">oidc-agent</span>:
	</p>
	<ul class="list-disc list-inside text-mc-gray dark:text-gray-300">
		<li>
			Install the corresponding package repository for your linux distribution. Details at:
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
			Install packages:<br />
			&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="font-mono">yum -y install oinit oidc-agent</span
			><br />
			&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="font-mono">apt -y install oinit oidc-agent</span>
		</li>
		<li>
			Log in:
			<MyCodeArea
				label="SSH commands with oinit:"
				id="oinitSshCmd"
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

	<hr />
	<h1 class="text-2xl font-semibold text-mc-gray dark:text-gray-300">Resources</h1>
	<p class="text-mc-gray dark:text-gray-300">
		Here are some resources to help you get started with SSH-OIDC.
	</p>
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
				href="https://github.com/ssh-oidc/webssh-oidc"
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
