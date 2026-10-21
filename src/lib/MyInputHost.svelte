<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { hostSchema, resetHost, isValidHost, type Host } from '$lib/types';
	import { z } from 'zod';
	import MySelect from './MySelect.svelte';

	export let disabled = false;
	export let showProtocol = false;
	export let title: string;

	export let host: Host;
	export let defaultHost: Host;

	let internalHost: Host = host;

	function unsetErrorStates() {
		errorStates = {
			hostname: false,
			port: false,
			protocol: false
		};
	}

	function setHost(newHost: Host) {
		if (JSON.stringify(newHost) !== JSON.stringify(host)) {
			host = newHost;
			dispatch('change', host);
		}
	}

	let customise = JSON.stringify(defaultHost) !== JSON.stringify(internalHost);
	const dispatch = createEventDispatcher<{ change: Host }>();

	let errorStates: { [index: string]: boolean } = {
		hostname: false,
		port: false,
		protocol: false
	};

	function validateInput() {
		try {
			const newHost = hostSchema.parse(internalHost);
			setHost(newHost);
		} catch (err) {
			console.log({ err }, err instanceof z.ZodError);
			if (err instanceof z.ZodError) {
				const zerr: z.ZodError = err;
				zerr.errors.forEach((e) => {
					if (e.path[0] in errorStates) errorStates[e.path[0]] = true;
				});
			} else if (err instanceof Error) {
				errorStates = {
					hostname: true,
					port: true,
					protocol: true
				};
			}
		}
	}

	function handleCustomise(e: Event) {
		console.log('HANDLE CUSTOMISE');
		customise = (e.target as HTMLInputElement).checked;
		if (!customise) {
			internalHost = { ...defaultHost };
			validateInput();
		}
	}

	function onProtocolChange(e: CustomEvent<string>) {
		function isProtocol(p: string | undefined): p is typeof internalHost.protocol {
			if (p === undefined) return true;
			return ['http', 'https'].includes(p);
		}

		if (!isProtocol(e.detail)) {
			console.error('Invalid protocol:', e.detail);
			return;
		}

		internalHost = { ...internalHost, protocol: e.detail };
		validateInput();
	}

	function onHostChange(e: Event) {
		const target = e.target as HTMLInputElement;
		internalHost = { ...internalHost, hostname: target.value };
		validateInput();
	}

	function onPortChange(e: Event) {
		const target = e.target as HTMLInputElement;
		internalHost = { ...internalHost, port: parseInt(target.value) };
		validateInput();
	}
</script>

<div class="flex flex-row place-content-between pt-4 pb-2 px-1">
	<div>
		<label for="hostname" class="block font-medium text-mc-gray dark:text-gray-200">{title}</label>
	</div>
	<div class="flex">
		<span class="ml-3 font-medium text-mc-gray dark:text-gray-300 pr-2">customise</span>
		<label class="inline-flex relative items-center cursor-pointer">
			<input
				type="checkbox"
				checked={customise}
				{disabled}
				on:change={handleCustomise}
				class="sr-only peer"
			/>
			<div class="checkbox peer" />
		</label>
	</div>
</div>
<div class="dualinput" class:triple={showProtocol}>
	{#if showProtocol}
		<MySelect
			name="protocol"
			hasError={errorStates.protocol}
			value={internalHost.protocol}
			disabled={!customise || disabled}
			values={['http', 'https']}
			descriptionTexts={{
				loading: '...',
				novals: '',
				choose: '--'
			}}
			on:select={onProtocolChange}
		>
			<div slot="selectedValue" let:value>
				{value}
			</div>
			<div slot="option" let:value>
				{value}
			</div>
		</MySelect>
	{/if}
	<input
		id="hostname"
		name="hostname"
		type="text"
		placeholder="hostname"
		value={internalHost.hostname}
		disabled={!customise || disabled}
		required
		class:error_state={errorStates.hostname}
		class:middle-child={showProtocol}
		class="min-w-0"
		on:change={onHostChange}
	/>
	<input
		id="port"
		name="port"
		type="number"
		placeholder="port"
		value={internalHost.port > 0 ? internalHost.port : ''}
		disabled={!customise || disabled}
		required
		class:error_state={errorStates.port}
		on:change={onPortChange}
	/>
</div>

<style lang="postcss">
	.dualinput {
		@apply grid gap-0;
		@apply grid-cols-[1fr,6rem];

		&.triple {
			@apply grid-cols-[5rem,1fr,6rem];
		}

		input {
			@apply relative block px-3 py-2 appearance-none rounded-md border focus:z-10 focus:outline-none sm:text-sm;
			@apply text-mc-gray placeholder-gray-300 focus:border-mc-blue-400 focus:ring-mc-blue-400;
			@apply disabled:bg-gray-100 disabled:opacity-50;
			@apply dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder-gray-500 dark:disabled:bg-gray-800;
		}

		input:first-child {
			@apply rounded-r-none;
		}

		input:last-child {
			@apply rounded-l-none;
		}

		.middle-child {
			@apply rounded-none;
		}
		.error_state {
			@apply border-mc-orange text-mc-orange;
		}
	}

	.checkbox {
		@apply w-11 h-6 rounded-full;
		@apply bg-gray-200 after:bg-white peer-checked:bg-mc-blue-400 peer-checked:after:border-white peer-focus:ring-mc-blue-200;
		@apply after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:border after:rounded-full after:h-5 after:w-5 after:transition-all;
		@apply peer-focus:ring-4;
		@apply peer-checked:after:translate-x-full;
	}
</style>
