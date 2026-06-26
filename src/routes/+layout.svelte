<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<AppShell>
	{@render children()}
</AppShell>
