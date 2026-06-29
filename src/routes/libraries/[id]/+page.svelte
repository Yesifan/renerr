<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { api, post } from '$lib/client/api';
	import { libraryLabel } from '$lib/client/formatters';
	import { queryKeys } from '$lib/client/query-keys';
	import { messages as m } from '$lib/i18n';
	import type { Item, Library } from '$lib/schemas/domain';
	import type { PageProps } from './$types';
	import LibraryItemGrid from './LibraryItemGrid.svelte';

	let { data, params }: PageProps = $props();
	const queryClient = useQueryClient();

	let message = $state('');
	let showTaskLink = $state(false);

	const librariesQuery = createQuery<Library[]>(() => ({
		queryKey: queryKeys.libraries,
		queryFn: () => api<Library[]>('/api/libraries'),
		initialData: [data.library],
		refetchInterval: 5000
	}));

	const itemsQuery = createQuery<Item[]>(() => ({
		queryKey: queryKeys.libraryItems(params.id),
		queryFn: () => api<Item[]>(`/api/library-items?libraryPathId=${params.id}`),
		initialData: data.items,
		refetchInterval: 2500
	}));

	const library = $derived(
		librariesQuery.data?.find((entry) => entry.id === params.id) ?? data.library
	);
	const items = $derived(itemsQuery.data ?? []);

	const scanLibraryMutation = createMutation(() => ({
		mutationFn: () => post(`/api/libraries/${params.id}/scan`),
		onSuccess: () => afterTaskMutation(m.toast_task_queued())
	}));

	async function afterTaskMutation(text: string) {
		message = text;
		showTaskLink = true;
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.libraries }),
			queryClient.invalidateQueries({ queryKey: queryKeys.libraryItems(params.id) }),
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
		]);
	}

	function busy() {
		return scanLibraryMutation.isPending;
	}
</script>

<svelte:head>
	<title>{library ? libraryLabel(library) : m.nav_media_library()} - Renarr</title>
</svelte:head>

<PageHeader title={m.nav_media_library()} description={library ? libraryLabel(library) : '正在加载'} {message}>
	{#snippet actions()}
		{#if showTaskLink}
			<Button href={resolve('/system/tasks')} variant="link">{m.nav_tasks()}</Button>
		{/if}
		<Button disabled={busy()} onclick={() => itemsQuery.refetch()} variant="outline">刷新</Button>
		<Button disabled={busy() || !library} onclick={() => scanLibraryMutation.mutate()}>{m.action_scan()}</Button>
	{/snippet}
</PageHeader>

<LibraryItemGrid {items} libraryPathId={params.id} />
