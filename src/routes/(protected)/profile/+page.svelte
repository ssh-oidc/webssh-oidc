<script lang="ts">
	import { onMount } from 'svelte';
	import { errorMessage, uiBlock } from '$lib/stores';
	import MyCodeArea from '$lib/MyCodeArea.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	const loginParams = {
		user: data.session?.user.name ?? data.session?.user.email ?? data.session?.user.id ?? 'User',
		accessToken: data.accessToken,
		mcEndpoint: data.userSession.mcEndpoint,
		sshInternalHost: {
			hostname: data.userSession.sshHostname,
			port: data.userSession.sshPort
		},
		sshUser: data.username,
		profile: data.session?.profile,
		userinfo: data.session?.userinfo
	};
	const displayInfo = JSON.stringify({ ...loginParams.profile, ...loginParams.userinfo }, null, 4);

	onMount(async () => {
		$uiBlock = false;
	});
</script>

<div class="flex flex-col gap-4 h-fit">
	<h1 class="text-2xl font-semibold text-mc-gray dark:text-gray-200">Welcome, {loginParams.user}!</h1>
	<p class="text-mc-gray dark:text-gray-300">
		You are logged in with the OIDC provider: <span class="font-semibold text-mc-orange"
			>{loginParams.profile?.iss}</span
		>.
		<br />
		Your local username is: <span class="font-semibold text-mc-orange">{loginParams.sshUser}</span>.
	</p>
	<MyCodeArea label="User info from OIDC provider" id="sshCmd" open={true} value={displayInfo} />
</div>
