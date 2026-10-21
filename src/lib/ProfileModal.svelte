<script lang="ts">
	import Icon from '@iconify/svelte';
	import MyCodeArea from '$lib/MyCodeArea.svelte';
	import { createEventDispatcher } from 'svelte';
	import { signOut } from '@auth/sveltekit/client';
	import { uiBlock } from '$lib/stores';

	export let open = false;
	export let userName: string;
	export let sshUser: string;
	export let issuer: string;
	export let profile: Record<string, unknown> | undefined;
	export let userinfo: Record<string, unknown> | undefined;

	const dispatch = createEventDispatcher<{ close: void }>();

	function close() {
		open = false;
		dispatch('close');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	async function handleLogout() {
		$uiBlock = true;
		await signOut();
	}

	$: displayInfo = JSON.stringify({ ...profile, ...userinfo }, null, 4);
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
	<div class="fixed inset-x-4 top-4 bottom-auto max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
		<!-- Header -->
		<div class="flex items-center justify-between px-6 py-3 border-b dark:border-gray-600">
			<h1 class="text-xl font-semibold text-mc-gray dark:text-gray-200">My Profile</h1>
			<button on:click={close} class="text-mc-gray dark:text-gray-300 hover:text-mc-blue-500">
				<Icon icon="mdi:close" class="text-2xl" />
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto px-6 py-4">
			<div class="flex flex-col gap-4">
				<h2 class="text-2xl font-semibold text-mc-gray dark:text-gray-200">Welcome, {userName}!</h2>
				<p class="text-mc-gray dark:text-gray-300">
					You are logged in with the OIDC provider: <span class="font-semibold text-mc-orange">{issuer}</span>.
					<br />
					Your local username is: <span class="font-semibold text-mc-orange">{sshUser}</span>.
				</p>
				<MyCodeArea label="User info from OIDC provider" id="profileUserInfo" open={true} value={displayInfo} />
			</div>
		</div>

		<!-- Footer -->
		<div class="flex justify-end px-6 py-3 border-t dark:border-gray-600">
			<button
				on:click={handleLogout}
				class="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded"
			>
				<Icon icon="mdi:logout" class="text-lg" />
				Sign Out
			</button>
		</div>
	</div>
{/if}
