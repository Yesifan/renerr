<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { resolve } from '$app/paths';
	import { api, post, put } from '$lib/client/api';
	import { libraryLabel, progressText, statusText } from '$lib/client/formatters';
	import { queryKeys } from '$lib/client/query-keys';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Switch } from '$lib/components/ui/switch';
	import { messages as m } from '$lib/i18n';
	import type {
		ActiveTaskSummary,
		Item,
		RenamePlanDraft,
		RenamePlanDraftRow,
		Task,
		TmdbEpisodeOption,
		TmdbSeasonOption,
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
	let manualSearchBusy = $state(false);
	let manualSearchError = $state('');

	const TMDB_OPTION_STALE_TIME_MS = 1000 * 60 * 30;
	let manualDialogOpen = $state(false);
	let planDialogOpen = $state(false);
	let recognizedItem = $state<Item | null>(null);
	let submittedTaskId = $state<string | null>(null);
	let showEmptyDetails = $state(false);

	type SubmitDraftResult = {
		plan: unknown;
		task: Task;
	};

	const draftQuery = createQuery<RenamePlanDraft>(() => ({
		queryKey: queryKeys.planDraft(draftId),
		queryFn: () => api<RenamePlanDraft>(`/api/rename-plan-drafts/${draftId}`),
		enabled: Boolean(draftId)
	}));

	const item = $derived(recognizedItem ?? data.item);
	const library = $derived(data.library);
	const manualResults = $derived(
		searchResults.length ? searchResults : item.recognitionCandidates || []
	);
	const activeTasksQuery = createQuery<ActiveTaskSummary[]>(() => ({
		queryKey: queryKeys.activeTasks([`libraryItem:${params.item_id}`]),
		queryFn: () =>
			api<ActiveTaskSummary[]>(
				`/api/tasks/active?targetKey=${encodeURIComponent(`libraryItem:${params.item_id}`)}`
			),
		refetchInterval: 2500
	}));
	const activeItemTask = $derived(activeTasksQuery.data?.[0] ?? null);
	const taskLinkId = $derived(submittedTaskId ?? activeItemTask?.id ?? null);

	const scanItemMutation = createMutation(() => ({
		mutationFn: (target: Item) => post(`/api/library-items/${target.id}/scan`),
		onSuccess: () => afterTaskMutation(m.toast_task_queued())
	}));

	const createDraftMutation = createMutation(() => ({
		mutationFn: (target: Item) => post<RenamePlanDraft>(`/api/library-items/${target.id}/plan`),
		onSuccess: async (draft) => {
			draftId = draft.id;
			planDialogOpen = true;
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
						sourceMediaId: row.sourceMediaId,
						title: row.title,
						originalTitle: row.originalTitle,
						year: row.year,
						posterPath: row.posterPath,
						posterUrl: row.posterUrl,
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
		mutationFn: () => post<SubmitDraftResult>(`/api/rename-plan-drafts/${draftId}/submit`),
		onSuccess: (result) => {
			submittedTaskId = result.task.id;
			return afterTaskMutation(m.toast_task_queued());
		}
	}));

	async function afterTaskMutation(text: string) {
		message = text;
		showTaskLink = true;
		planDialogOpen = false;
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.libraries }),
			queryClient.invalidateQueries({ queryKey: queryKeys.libraryItems(params.id) }),
			queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
			queryClient.invalidateQueries({
				queryKey: queryKeys.activeTasks([`libraryItem:${params.item_id}`])
			})
		]);
	}

	async function searchItem(target: Item) {
		const query = manualSearch || target.title || target.topLevelPath;
		manualSearchBusy = true;
		manualSearchError = '';
		try {
			searchResults = await searchMedia(query);
		} catch (error) {
			manualSearchError = String(error);
			searchResults = [];
		} finally {
			manualSearchBusy = false;
		}
	}

	async function searchMedia(query: string) {
		return api<TmdbResult[]>(
			`/api/library-items/${params.item_id}/recognition/search?q=${encodeURIComponent(query)}`
		);
	}

	async function loadSeasonOptions(tmdbId: string) {
		return queryClient.fetchQuery({
			queryKey: queryKeys.tmdbTvSeasons(tmdbId),
			queryFn: () => api<TmdbSeasonOption[]>(`/api/tmdb/tv/${encodeURIComponent(tmdbId)}/seasons`),
			staleTime: TMDB_OPTION_STALE_TIME_MS
		});
	}

	async function loadEpisodeOptions(tmdbId: string, season: number) {
		return queryClient.fetchQuery({
			queryKey: queryKeys.tmdbTvEpisodes(tmdbId, season),
			queryFn: () =>
				api<TmdbEpisodeOption[]>(
					`/api/tmdb/tv/${encodeURIComponent(tmdbId)}/seasons/${season}/episodes`
				),
			staleTime: TMDB_OPTION_STALE_TIME_MS
		});
	}

	async function chooseIdentity(target: Item, result: TmdbResult) {
		recognizedItem = await post<Item>(`/api/library-items/${target.id}/recognize`, {
			sourceMediaType: library.mediaType,
			sourceMediaId: String(result.id),
			title: result.title,
			originalTitle: result.originalTitle,
			year: result.year,
			posterPath: result.posterPath
		});
		message = m.toast_saved();
		manualDialogOpen = false;
		searchResults = [];
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.libraries }),
			queryClient.invalidateQueries({ queryKey: queryKeys.libraryItems(params.id) })
		]);
		await createDraftMutation.mutateAsync(target);
	}

	async function submitDraft() {
		await submitDraftMutation.mutateAsync();
		draftId = null;
	}

	function busy() {
		return (
			scanItemMutation.isPending ||
			Boolean(activeItemTask) ||
			createDraftMutation.isPending ||
			updateDraftMutation.isPending ||
			submitDraftMutation.isPending
		);
	}

	function canManualMatch(target: Item) {
		return target.status === 'pending_review' || target.status === 'identified';
	}

	function canScanItem(target: Item) {
		return (
			target.status === 'organized' ||
			target.status === 'identified' ||
			target.status === 'unidentified'
		);
	}

	function canCreatePlan(target: Item) {
		return (
			target.status === 'identified' ||
			(target.status === 'organized' && (target.nonCompliantFileCount ?? 0) > 0)
		);
	}

	function taskActionLabel(task: ActiveTaskSummary) {
		if (task.type === 'create_rename_plan_for_item') return '正在创建整理计划';
		return task.type === 'execute_rename_plan' ? '正在整理' : '正在扫描';
	}
</script>

<svelte:head>
	<title>{item.title || item.topLevelPath} - Renarr</title>
</svelte:head>

<div class="flex flex-col gap-5">
	<header class="flex flex-wrap items-center justify-between gap-3">
		<div class="min-w-0">
			<a
				class="text-sm text-muted-foreground hover:text-foreground"
				href={resolve('/libraries/[id]', { id: params.id })}
			>
				{libraryLabel(library)}
			</a>
			{#if message}
				<div class="mt-1 text-sm text-muted-foreground">{message}</div>
			{/if}
		</div>
		<div class="flex flex-wrap items-center justify-end gap-2">
			<Button href={resolve('/libraries/[id]', { id: params.id })} variant="outline"
				>返回列表</Button
			>
			{#if showTaskLink}
				<Button href={resolve('/system/tasks')} variant="link">{m.nav_tasks()}</Button>
			{/if}
			{#if taskLinkId}
				<Button href={resolve(`/system/tasks/${taskLinkId}`)} variant="link">
					{#if activeItemTask}
						{progressText(activeItemTask.progress) || statusText(activeItemTask.state)}
					{:else}
						任务详情
					{/if}
				</Button>
			{/if}
			{#if canScanItem(item)}
				<Button disabled={busy()} onclick={() => scanItemMutation.mutate(item)} variant="outline">
					{m.action_scan()}
				</Button>
			{/if}
			{#if canManualMatch(item)}
				<Button disabled={busy()} onclick={() => (manualDialogOpen = true)} variant="outline">
					{m.action_manual_match()}
				</Button>
			{/if}
			{#if canCreatePlan(item)}
				<Button disabled={busy()} onclick={() => createDraftMutation.mutate(item)}>
					{m.action_view_plan()}
				</Button>
			{/if}
		</div>
	</header>

	<ItemDetailPanel {item} {library} />

	{#if activeItemTask}
		<section class="rounded-md border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
			<div class="font-medium">
				{taskActionLabel(activeItemTask)} ·
				{progressText(activeItemTask.progress) || statusText(activeItemTask.state)}
			</div>
			<div class="mt-1 text-xs text-sky-100/70">
				<a
					class="text-sky-100 underline underline-offset-4"
					href={resolve(`/system/tasks/${activeItemTask.id}`)}>查看任务详情</a
				>
			</div>
		</section>
	{/if}

	{#if item.empty}
		<section class="rounded-md border border-border bg-muted/20 p-4">
			<label class="flex items-center justify-between gap-4">
				<span>
					<span class="block text-sm font-medium text-foreground">显示空目录信息</span>
					<span class="mt-1 block text-xs text-muted-foreground"
						>该项当前没有可统计的视频文件，默认不会出现在媒体库列表中。</span
					>
				</span>
				<Switch
					size="sm"
					checked={showEmptyDetails}
					onclick={() => (showEmptyDetails = !showEmptyDetails)}
				/>
			</label>
			{#if showEmptyDetails}
				<div class="mt-4 grid gap-3 border-t border-border pt-4 text-sm md:grid-cols-3">
					<div>
						<div class="text-xs text-muted-foreground">状态</div>
						<div class="mt-1 text-foreground">无视频文件</div>
					</div>
					<div>
						<div class="text-xs text-muted-foreground">最近扫描</div>
						<div class="mt-1 text-foreground">{item.lastScannedAt || '暂无记录'}</div>
					</div>
					<div>
						<div class="text-xs text-muted-foreground">远端名称</div>
						<div class="mt-1 break-all font-mono text-foreground">{item.topLevelPath}</div>
					</div>
				</div>
			{/if}
		</section>
	{/if}
</div>

<Dialog.Root bind:open={manualDialogOpen}>
	<Dialog.Content class="max-h-[86vh] overflow-auto rounded-lg sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>{m.action_manual_match()}</Dialog.Title>
			<Dialog.Description>选择 TMDB 结果后会直接生成可编辑的整理计划。</Dialog.Description>
		</Dialog.Header>
		<ManualMatchPanel
			{item}
			query={manualSearch}
			results={manualResults}
			searchLabel="搜索"
			busy={busy()}
			searchBusy={manualSearchBusy}
			searchError={manualSearchError}
			onQueryChange={(value) => (manualSearch = value)}
			onSearch={searchItem}
			onChoose={chooseIdentity}
		/>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={planDialogOpen}>
	<Dialog.Content
		class="max-h-[92vh] overflow-auto rounded-lg sm:max-w-[min(1180px,calc(100%-2rem))]"
	>
		<Dialog.Header>
			<Dialog.Title>整理计划</Dialog.Title>
			<Dialog.Description
				>先核对每行影视信息、季集和冲突处理，再确认最终目标完整路径。</Dialog.Description
			>
		</Dialog.Header>
		{#if draftQuery.data}
			<RenamePlanPanel
				draft={draftQuery.data}
				busy={busy()}
				submitLabel={m.action_submit()}
				onUpdateRow={(row) => updateDraftMutation.mutate(row)}
				onSubmit={submitDraft}
				onSearchMedia={searchMedia}
				onLoadSeasonOptions={loadSeasonOptions}
				onLoadEpisodeOptions={loadEpisodeOptions}
			/>
		{:else}
			<div class="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
				正在生成整理计划...
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
