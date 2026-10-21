<script lang="ts">
	import { marked } from 'marked';
	export let source: string;
	$: html = marked.parse(source, { async: false }) as string;
</script>

<div class="flex place-content-center lg:py-10">
	<div
		class="max-w-6xl bg-white dark:bg-gray-800 rounded-lg shadow p-10 mx-auto prose dark:prose-invert text-mc-gray"
	>
		{@html html}
	</div>
</div>
