<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import {
		api,
		post,
		put
	} from '$lib/client/api';
	import { libraryLabel } from '$lib/client/formatters';
	import { queryKeys } from '$lib/client/query-keys';
	import { messages as m } from '$lib/i18n';
	import type {
		Item,
		ItemDetail,
		Library,
		RenamePlanDraft,
		RenamePlanDraftRow,
		TmdbResult
	} from '$lib/schemas/domain';
	import type { PageProps } from './$types';
	import ItemDetailPanel from './ItemDetailPanel.svelte';
	import LibraryItemGrid from './LibraryItemGrid.svelte';
	import RenamePlanPanel from './RenamePlanPanel.svelte';

	let { data, params }: PageProps = $props();
	const queryClient = useQueryClient();

	let selectedItemId = $state<string | null>(null);
	let draftId = $state<string | null>(null);
	let message = $state('');
	let showTaskLink = $state(false);
	let manualSearch = $state<Record<string, string>>({});
	let searchResults = $state<Record<string, TmdbResult[]>>({});

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

	const detailQuery = createQuery<ItemDetail>(() => ({
		queryKey: queryKeys.itemDetail(selectedItemId),
		queryFn: () => api<ItemDetail>(`/api/library-items/${selectedItemId}`),
		enabled: Boolean(selectedItemId)
	}));

	const draftQuery = createQuery<RenamePlanDraft>(() => ({
		queryKey: queryKeys.planDraft(draftId),
		queryFn: () => api<RenamePlanDraft>(`/api/rename-plan-drafts/${draftId}`),
		enabled: Boolean(draftId)
	}));

	const library = $derived(
		librariesQuery.data?.find((entry) => entry.id === params.id) ?? data.library
	);
	const items = $derived(itemsQuery.data ?? []);
	const selectedItem = $derived(items.find((item) => item.id === selectedItemId) ?? null);

	const scanLibraryMutation = createMutation(() => ({
		mutationFn: () => post(`/api/libraries/${params.id}/scan`),
		onSuccess: () => afterTaskMutation(m.toast_task_queued())
	}));

	const scanItemMutation = createMutation(() => ({
		mutationFn: (item: Item) => post(`/api/library-items/${item.id}/scan`),
		onSuccess: () => afterTaskMutation(m.toast_task_queued())
	}));

	const createDraftMutation = createMutation(() => ({
		mutationFn: (item: Item) => post<RenamePlanDraft>(`/api/library-items/${item.id}/plan`),
		onSuccess: async (draft) => {
			draftId = draft.id;
			message = m.action_view_plan();
			await queryClient.invalidateQueries({ queryKey: queryKeys.planDraft(draft.id) });
		}
	}));

	const updateDraftMutation = createMutation(() => ({
		mutationFn: (row: RenamePlanDraftRow) =>
			put<RenamePlanDraft>(`/api/rename-plan-drafts/${draftId}`, {
				rows: [
					{
						id: row.id,
						selected: row.selected,
						season: row.season,
						episode: row.episode,
						conflictAction: row.conflictAction
					}
				]
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: queryKeys.planDraft(draftId) });
		}
	}));

	const submitDraftMutation = createMutation(() => ({
		mutationFn: () => post(`/api/rename-plan-drafts/${draftId}/submit`),
		onSuccess: () => afterTaskMutation(m.toast_task_queued())
	}));

	async function afterTaskMutation(text: string) {
		message = text;
		showTaskLink = true;
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.libraries }),
			queryClient.invalidateQueries({ queryKey: queryKeys.libraryItems(params.id) }),
			queryClient.invalidateQueries({ queryKey: queryKeys.itemDetail(selectedItemId) }),
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
		]);
	}

	function selectItem(item: Item) {
		selectedItemId = item.id;
		draftId = null;
		message = '';
		showTaskLink = false;
	}

	async function searchItem(item: Item) {
		const query = manualSearch[item.id] || item.title || item.topLevelPath;
		const type = library?.mediaType || 'tv';
		searchResults[item.id] = await api<TmdbResult[]>(
			`/api/library-items/${item.id}/recognition/search?type=${type}&q=${encodeURIComponent(query)}`
		);
	}

	async function chooseIdentity(item: Item, result: TmdbResult) {
		await post(`/api/library-items/${item.id}/recognize`, {
			sourceMediaType: library?.mediaType || 'tv',
			sourceMediaId: String(result.id),
			title: result.title,
			originalTitle: result.originalTitle,
			year: result.year,
			posterPath: result.posterPath
		});
		message = m.toast_saved();
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.libraries }),
			queryClient.invalidateQueries({ queryKey: queryKeys.libraryItems(params.id) }),
			queryClient.invalidateQueries({ queryKey: queryKeys.itemDetail(item.id) })
		]);
	}

	function updateManualSearch(item: Item, value: string) {
		manualSearch[item.id] = value;
	}

	async function submitDraft() {
		const rows = draftQuery.data?.rows ?? [];
		if (rows.some((row) => row.selected && row.conflictAction === 'overwrite') && !confirm('确认覆盖冲突文件？')) {
			return;
		}
		await submitDraftMutation.mutateAsync();
		draftId = null;
	}

	function busy() {
		return (
			scanLibraryMutation.isPending ||
			scanItemMutation.isPending ||
			createDraftMutation.isPending ||
			updateDraftMutation.isPending ||
			submitDraftMutation.isPending
		);
	}

	function canManualMatch(item: Item) {
		return item.status === 'pending_review' || item.status === 'failed';
	}

	function canScanItem(item: Item) {
		return item.status === 'organized' || item.status === 'unidentified' || item.status === 'failed';
	}

	function canCreatePlan(item: Item) {
		return item.status === 'identified' || item.status === 'organized' || (item.status === 'failed' && Boolean(item.sourceMediaId));
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

<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
	<LibraryItemGrid
		{items}
		{selectedItemId}
		{manualSearch}
		{searchResults}
		searchLabel={m.action_manual_match()}
		onSelect={selectItem}
		{canManualMatch}
		onManualQueryChange={updateManualSearch}
		onSearch={searchItem}
		onChooseIdentity={chooseIdentity}
	/>

	<aside class="flex flex-col gap-4">
		<ItemDetailPanel
			{selectedItem}
			detail={detailQuery.data}
			isFetching={detailQuery.isFetching}
			scanLabel={m.action_scan()}
			planLabel={m.action_view_plan()}
			{canScanItem}
			{canCreatePlan}
			onScan={(item) => scanItemMutation.mutate(item)}
			onCreatePlan={(item) => createDraftMutation.mutate(item)}
		/>

		{#if draftQuery.data}
			<RenamePlanPanel
				draft={draftQuery.data}
				busy={busy()}
				submitLabel={m.action_submit()}
				onUpdateRow={(row) => updateDraftMutation.mutate(row)}
				onSubmit={submitDraft}
			/>
		{/if}
	</aside>
</div>
