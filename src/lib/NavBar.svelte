<script lang="ts">
	import logo from '$lib/assets/webssh-oidc-square.png';
	import { goto } from '$app/navigation';

	const handleGoHome = () => {
		goto('/terminal');
	};
</script>

<nav
	class="px-2 py-4 bg-white/80 dark:bg-gray-800/80
            backdrop-blur-md shadow-md w-full
            fixed top-0 left-0 right-0 z-10 h-20"
>
	<div class="flex flex-row sm:w-4/5 mx-auto sm:px-0 px-6">
		<button type="button" id="home" title="Home" on:click={handleGoHome}>
			<div class="flex items-center space-x-3">
				<img class="h-10 object-cover" src={logo} alt="webssh-oidc logo" />
				<h3 class="text-xl text-mc-gray dark:text-gray-200 font-semibold tracking-tight">SSH with OIDC</h3>
			</div>
		</button>
	</div>
</nav>
