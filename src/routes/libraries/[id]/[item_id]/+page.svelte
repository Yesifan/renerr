<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { resolve } from '$app/paths';
	import { api, post, put } from '$lib/client/api';
	import { libraryLabel, statusClass, statusText } from '$lib/client/formatters';
	import { queryKeys } from '$lib/client/query-keys';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { messages as m } from '$lib/i18n';
	import type {
		Item,
		ItemDetail,
		RenamePlanDraft,
		RenamePlanDraftRow,
		TmdbResult
	} from '$lib/schemas/domain';
	import type { PageProps } from './$types';
	import ItemDetailPanel from '../ItemDetailPanel.svelte';
	import ManualMatchPanel from '../ManualMatchPanel.svelte';
	import RenamePlanPanel from '../RenamePlanPanel.svelte';

	let { data, params }: PageProps = $props();
	const queryClient = useQueryClient();

	let draftId = $state<string | null>(null);
	let message = $state('');
	let showTaskLink = $state(false);
	let manualSearch = $state('');
	let searchResults = $state<TmdbResult[]>([]);

	const detailQuery = createQuery<ItemDetail>(() => ({
		queryKey: queryKeys.itemDetail(params.item_id),
		queryFn: () => api<ItemDetail>(`/api/library-items/${params.item_id}`)
	}));

	const draftQuery = createQuery<RenamePlanDraft>(() => ({
		queryKey: queryKeys.planDraft(draftId),
		queryFn: () => api<RenamePlanDraft>(`/api/rename-plan-drafts/${draftId}`),
		enabled: Boolean(draftId)
	}));

	const item = $derived(detailQuery.data?.item ?? data.item);
	const library = $derived(detailQuery.data?.library ?? data.library);
	const manualResults = $derived(searchResults.length ? searchResults : item.recognitionCandidates || []);

	const scanItemMutation = createMutation(() => ({
		mutationFn: (target: Item) => post(`/api/library-items/${target.id}/scan`),
		onSuccess: () => afterTaskMutation(m.toast_task_queued())
	}));

	const createDraftMutation = createMutation(() => ({
		mutationFn: (target: Item) => post<RenamePlanDraft>(`/api/library-items/${target.id}/plan`),
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
			queryClient.invalidateQueries({ queryKey: queryKeys.itemDetail(params.item_id) }),
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
		]);
	}

	async function searchItem(target: Item) {
		const query = manualSearch || target.title || target.topLevelPath;
		searchResults = await api<TmdbResult[]>(
			`/api/library-items/${target.id}/recognition/search?q=${encodeURIComponent(query)}`
		);
	}

	async function chooseIdentity(target: Item, result: TmdbResult) {
		await post(`/api/library-items/${target.id}/recognize`, {
			sourceMediaType: library.mediaType,
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
			queryClient.invalidateQueries({ queryKey: queryKeys.itemDetail(target.id) })
		]);
	}

	async function submitDraft() {
		const rows = draftQuery.data?.rows ?? [];
		if (
			rows.some((row) => row.selected && row.conflictAction === 'overwrite') &&
			!confirm('确认覆盖冲突文件？')
		) {
			return;
		}
		await submitDraftMutation.mutateAsync();
		draftId = null;
	}

	function busy() {
		return (
			scanItemMutation.isPending ||
			createDraftMutation.isPending ||
			updateDraftMutation.isPending ||
			submitDraftMutation.isPending
		);
	}

	function canManualMatch(target: Item) {
		return target.status === 'pending_review' || target.status === 'failed';
	}

	function canScanItem(target: Item) {
		return target.status === 'organized' || target.status === 'unidentified' || target.status === 'failed';
	}

	function canCreatePlan(target: Item) {
		return (
			target.status === 'identified' ||
			target.status === 'organized' ||
			(target.status === 'failed' && Boolean(target.sourceMediaId))
		);
	}
</script>

<svelte:head>
	<title>{item.title || item.topLevelPath} - Renarr</title>
</svelte:head>

<PageHeader title={item.title || item.topLevelPath} description={libraryLabel(library)} {message}>
	{#snippet actions()}
		<Button href={resolve('/libraries/[id]', { id: params.id })} variant="outline">返回列表</Button>
		{#if showTaskLink}
			<Button href={resolve('/system/tasks')} variant="link">{m.nav_tasks()}</Button>
		{/if}
		<Button disabled={detailQuery.isFetching} onclick={() => detailQuery.refetch()} variant="outline">刷新</Button>
		{#if canScanItem(item)}
			<Button disabled={busy()} onclick={() => scanItemMutation.mutate(item)} variant="outline">
				{m.action_scan()}
			</Button>
		{/if}
		{#if canCreatePlan(item)}
			<Button disabled={busy()} onclick={() => createDraftMutation.mutate(item)}>
				{m.action_view_plan()}
			</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
	<div class="flex min-w-0 flex-col gap-4">
		<ItemDetailPanel {item} detail={detailQuery.data} isFetching={detailQuery.isFetching} />

		{#if draftQuery.data}
			<RenamePlanPanel
				draft={draftQuery.data}
				busy={busy()}
				submitLabel={m.action_submit()}
				onUpdateRow={(row) => updateDraftMutation.mutate(row)}
				onSubmit={submitDraft}
			/>
		{/if}
	</div>

	<aside class="flex min-w-0 flex-col gap-4">
		<Card.Root>
			<Card.Header>
				<Card.Title>Item 摘要</Card.Title>
				<Card.Description>扫描缓存摘要，文件详情以实时读取为准。</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-3">
				<div class="aspect-[2/3] overflow-hidden rounded-xl bg-muted">
					{#if item.posterUrl}
						<img class="h-full w-full object-cover" src={item.posterUrl} alt={item.title || item.topLevelPath} />
					{:else}
						<div class="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
							{item.kind === 'folder' ? '文件夹' : '视频文件'}
						</div>
					{/if}
				</div>
				<div class="flex flex-wrap gap-2">
					<Badge variant="outline" class={statusClass(item.status)}>
						{statusText(item.status, item.reviewReason)}
					</Badge>
					{#if item.nonCompliantFileCount}
						<Badge variant="outline" class="border-amber-500/30 bg-amber-500/15 text-amber-300">
							待整理 {item.nonCompliantFileCount}
						</Badge>
					{/if}
				</div>
				<div class="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
					<div class="rounded-xl bg-muted p-2">视频 {item.videoFileCount}</div>
					<div class="rounded-xl bg-muted p-2">符合 {item.compliantFileCount ?? 0}</div>
					<div class="rounded-xl bg-muted p-2">待整理 {item.nonCompliantFileCount ?? 0}</div>
				</div>
			</Card.Content>
		</Card.Root>

		{#if canManualMatch(item)}
			<Card.Root>
				<Card.Header>
					<Card.Title>{m.action_manual_match()}</Card.Title>
					<Card.Description>为 pending 或 failed item 指定 TMDB identity。</Card.Description>
				</Card.Header>
				<Card.Content>
					<ManualMatchPanel
						{item}
						query={manualSearch}
						results={manualResults}
						searchLabel={m.action_manual_match()}
						onQueryChange={(value) => (manualSearch = value)}
						onSearch={searchItem}
						onChoose={chooseIdentity}
					/>
				</Card.Content>
			</Card.Root>
		{/if}
	</aside>
</div>
