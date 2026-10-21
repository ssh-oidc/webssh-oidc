<script lang="ts">
	import LoginComponent from '$lib/LoginComponent.svelte';
	import type { PageData } from './$types';

	export let data: PageData;
</script>

<div class="grid place-items-center items-center justify-stretch">
	<LoginComponent providers={data.providers} config={data.config} />
</div>
