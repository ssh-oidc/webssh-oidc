<script lang="ts">
	import type { TerminalSessionInfo } from '$lib/server/sessions';
	import { createEventDispatcher } from 'svelte';

	export let tabInfo: TerminalSessionInfo;
	export let isActive = false;

	let dispatch = createEventDispatcher();
</script>

<div
	data-active={isActive ? 'true' : undefined}
	class="flex flex-row space-between py-1 bg-neutral-300 dark:bg-gray-700 hover:bg-mc-blue-500 rounded-t-lg text-mc-gray-700 dark:text-gray-300 hover:text-white data-[active]:bg-mc-blue-600 data-[active]:text-white"
>
	<button class="px-2" on:click={() => dispatch('clicked', tabInfo)}>
		{tabInfo.name}
	</button>

	<button class="px-2 hover:text-mc-orange" on:click={() => dispatch('closed', tabInfo)}>
		<svg class="w-4 h-auto" viewBox="0 0 20 20" fill="currentColor">
			<path
				fill-rule="evenodd"
				d="M10 0c5.52 0 10 4.48 10 10s-4.48 10-10 10S0 15.52 0 10 4.48 0 10 0zm5 11.41L14.41 15 10 10.59 5.59 15 4 13.41 8.41 9 4 4.59 5.59 3 10 7.41 14.41 3 16 4.59 11.59 9 16 13.41z"
			></path>
		</svg>
	</button>
</div>
