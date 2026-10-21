<script lang="ts">
	import Icon from '@iconify/svelte';

	export let label: string;
	export let value: string;
	export let id: string;
	export let open: boolean = false;

	let selected = false;
	let disabled = false;
	let copyIcon = 'mdi:content-copy';

	const copyToClipboard = (e: Event) => {
		e.stopPropagation();
		if (value) {
			function copySuccessful() {
				selected = true;
				copyIcon = 'mdi:check';
				disabled = true;
				setTimeout(() => {
					selected = false;
					copyIcon = 'mdi:content-copy';
					disabled = false;
				}, 300);
			}
			navigator.clipboard.writeText(value).then(copySuccessful, () => {});
		}
	};

	const toggle = () => {
		open = !open;
	};
</script>

<div>
	<button
		type="button"
		on:click={toggle}
		class="flex items-center justify-between w-full font-medium text-mc-gray dark:text-gray-200 m-1 px-2.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
	>
		<span>{label}</span>
		<Icon icon={open ? 'mdi:chevron-up' : 'mdi:chevron-down'} class="inline text-xl" />
	</button>

	{#if open}
		<div class="relative">
			<span {id} class="textarea" class:selected>{value}</span>
			<button
				{disabled}
				class="absolute top-0 right-5 -translate-y-full m-1 px-4 p-2.5 text-mc-gray dark:text-gray-300 rounded opacity-50 hover:opacity-100"
				on:click={copyToClipboard}
			>
				<Icon icon={copyIcon} class="inline" />
			</button>
		</div>
	{/if}
</div>

<style lang="postcss">
	.textarea {
		word-wrap: break-word;
		word-break: break-all;
		white-space: pre-wrap;
		@apply font-mono;
		@apply block bg-transparent resize-none p-2.5 w-full text-sm text-mc-gray rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500;
		@apply dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-gray-200 dark:focus:ring-blue-500 dark:focus:border-blue-500;
	}

	.selected {
		@apply bg-blue-400 text-white;
		@apply dark:bg-mc-blue dark:text-white;
	}
</style>
