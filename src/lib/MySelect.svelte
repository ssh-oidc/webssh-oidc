<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	import { slide } from 'svelte/transition';
	import { clickOutside } from '$lib/clickoutside';

	export let hasError: boolean = false;
	export let name: string;
	export let values: string[] | undefined;
	export let descriptionTexts: {
		loading: string;
		novals: string;
		choose: string;
	};
	export let value: string | undefined;
	export let disabled = false;

	let expand = false;
	const dispatch = createEventDispatcher<{ select: string }>();

	function handleExpand() {
		if (!disabled) expand = !expand;
	}
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	id={name}
	class="relative w-full select-none text-base text-mc-gray dark:text-gray-200 px-3 py-2 border border-solid dark:border-gray-600 dark:bg-gray-700 focus:outline-none focus:ring-mc-blue-400 focus:border-mc-blue-400 data-[error]:border-red-500 first:rounded-l-md last:rounded-r-md rounded-none"
	class:disabled
	class:expanded={!disabled && expand}
	class:selected={!expand && value}
	data-error={hasError ? 'true' : undefined}
	on:click={handleExpand}
	on:keydown
	use:clickOutside
	on:outsideclick={() => (expand = false)}
>
	<div class="flex flex-row">
		{#key value}
			{#if value}
				<slot name="selectedValue" {value} />
			{:else}
				{values === undefined
					? descriptionTexts.loading
					: !Object.values(values).length
						? descriptionTexts.novals
						: descriptionTexts.choose}
			{/if}
		{/key}
		<!-- <div class="absolute top-1 -right-2 h-full w-8 flex items-center justify-center"> -->
		<div class="absolute -right-0 top-3">
			<svg
				class="w-6 h-6 fill-current text-mc-gray"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 20 20"
			>
				<path d="M7 6l-3 3-3-3" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
			</svg>
			<!-- ⌄ -->
		</div>
	</div>
	{#if expand}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div
			transition:slide|global={{ duration: 400 }}
			class="absolute top-10 left-0 w-full bg-gray-100 dark:bg-gray-700 text-mc-gray dark:text-gray-200 z-10 shadow-md rounded-md overflow-clip"
			on:click|stopPropagation={handleExpand}
			on:keydown
		>
			{#each Object.values(values || {}) as val}
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<div
					class="p-2 cursor-pointer hover:bg-mc-blue-200 hover:text-white"
					on:keydown
					on:click={() => {
						value = val;
						dispatch('select', value);
					}}
				>
					<slot name="option" value={val} />
				</div>
			{/each}
		</div>
	{/if}
</div>

<style lang="postcss">
	.expanded {
		@apply border-mc-blue-400 ring-mc-blue-400;
		@apply text-mc-gray-300;
	}
	.disabled {
		/* @apply cursor-not-allowed; */
		@apply opacity-50 bg-gray-100 dark:bg-gray-800;
	}
	.selected {
		@apply text-mc-gray;
	}
</style>
