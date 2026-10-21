<script lang="ts">
	import Markdown from '$lib/Markdown.svelte';
	import { onMount } from 'svelte';
	import { uiBlock } from '$lib/stores';

	let privacy_path = '/docs/privacy.md';
	let privacy = 'No privacy policy found.';

	onMount(async () => {
		const response = await fetch(new Request(privacy_path));
		if (response.ok) {
			privacy = await response.text();
		}
		$uiBlock = false;
	});
</script>

<Markdown source={privacy} />
