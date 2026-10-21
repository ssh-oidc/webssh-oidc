<script lang="ts">
	import { page } from '$app/stores';
	import { loginParams } from '$lib/stores';
	import MyCodeArea from '$lib/MyCodeArea.svelte';

	$: sshCmd = `ssh -p ${$loginParams?.sshInternalHost?.port} ${$loginParams?.username}@${$loginParams?.sshInternalHost?.hostname}`;
	$: mccliCmd = `mccli --mc-endpoint ${$loginParams?.mcEndpoint
		.toString()
		.replace(/\/$/, '')} --token ${$page.data.session?.accessToken ?? ''} ssh -p ${
		$loginParams?.sshInternalHost?.port
	} ${$loginParams?.sshInternalHost?.hostname}`;
</script>

<div class="mt-8 space-6 flex flex-col gap-4">
	<MyCodeArea label="SSH commandline" id="sshCmd" value={sshCmd} />
	<MyCodeArea label="Access Token" id="token" value={$page.data.session?.accessToken ?? ''} />
	<MyCodeArea label="mccli command" id="mccliCmd" value={mccliCmd} />
</div>
