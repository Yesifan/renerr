<script lang="ts">
	import AppShell from '$lib/components/AppShell.svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

	let { children } = $props();
	const queryClient = new QueryClient();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<QueryClientProvider client={queryClient}>
	<AppShell>
		{@render children()}
	</AppShell>
</QueryClientProvider>
