<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { providers, generic, type Provider } from '$lib/providers';

	export let provider_issuer: string;

	const dispatch = createEventDispatcher<{ click: string }>();

	const normalizeIssuer = (issuer: string) => issuer.trim().replace(/\/+$/, '');

	const normalizedProviders: Record<string, Provider> = Object.fromEntries(
		Object.entries(providers).map(([issuer, provider]) => [normalizeIssuer(issuer), provider])
	);

	let provider: Provider;

	$: provider = normalizedProviders[normalizeIssuer(provider_issuer)] ?? {
		name: provider_issuer,
		logo: generic.logo
	};

	function selectProvider() {
		dispatch('click', provider_issuer);
	}
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<!-- svelte-ignore a11y-missing-attribute -->
<div class="grid grid-flow-col justify-start h-5 mb-1" on:click={selectProvider}>
	<img class="mx-2 my-2 h-3 w-auto" src={provider.logo} />
	<div class="mx-2 align-middle">{provider.name}</div>
</div>
