<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let disabled = false;

	let dispatch = createEventDispatcher();
</script>

<button
	{disabled}
	type="submit"
	class="group button"
	on:click={() => {
		dispatch('click');
	}}
>
	<slot />
</button>

<style lang="postcss">
	@reference '../app.css';
	.button {
		@apply relative flex w-full justify-center rounded-md border border-transparent;
		@apply bg-mc-blue-500 py-2 px-4 text-base font-medium text-white enabled:hover:bg-mc-blue-400;
		@apply focus:outline-none focus:ring-2 focus:ring-mc-blue-400 focus:ring-offset-2;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
</style>
