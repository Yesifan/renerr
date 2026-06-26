<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import {
		api,
		libraryLabel,
		post,
		put,
		statusClass,
		statusText,
		type Item,
		type ItemDetail,
		type Library,
		type RenamePlanDraft,
		type RenamePlanDraftRow,
		type TmdbResult,
		type Workspace
	} from '$lib/client/api';
	import { queryKeys } from '$lib/client/query-keys';
	import { messages as m } from '$lib/i18n';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	const queryClient = useQueryClient();

	let selectedItemId = $state<string | null>(null);
	let draftId = $state<string | null>(null);
	let message = $state('');
	let showTaskLink = $state(false);
	let manualSearch = $state<Record<string, string>>({});
	let searchResults = $state<Record<string, TmdbResult[]>>({});

	const workspaceQuery = createQuery<Workspace>(() => ({
		queryKey: queryKeys.workspace,
		queryFn: () => api<Workspace>('/api/workspace'),
		refetchInterval: 5000
	}));

	const itemsQuery = createQuery<Item[]>(() => ({
		queryKey: queryKeys.libraryItems(params.id),
		queryFn: () => api<Item[]>(`/api/library-items?libraryPathId=${params.id}`),
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
		workspaceQuery.data?.libraries.find((entry) => entry.id === params.id) as Library | undefined
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
			queryClient.invalidateQueries({ queryKey: queryKeys.workspace }),
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
			queryClient.invalidateQueries({ queryKey: queryKeys.workspace }),
			queryClient.invalidateQueries({ queryKey: queryKeys.libraryItems(params.id) }),
			queryClient.invalidateQueries({ queryKey: queryKeys.itemDetail(item.id) })
		]);
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

<header class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<div>
		<h1 class="text-2xl font-semibold text-slate-100">{m.nav_media_library()}</h1>
		<p class="mt-1 text-sm text-slate-400">
			{library ? libraryLabel(library) : '正在加载'}
		</p>
	</div>
	<div class="flex items-center gap-3">
		{#if message}<span class="text-sm text-slate-400">{message}</span>{/if}
		{#if showTaskLink}
			<a class="text-sm text-cyan-300 hover:underline" href={resolve('/system/tasks')}>{m.nav_tasks()}</a>
		{/if}
		<Button disabled={busy()} onclick={() => itemsQuery.refetch()} variant="outline">刷新</Button>
		<Button disabled={busy() || !library} onclick={() => scanLibraryMutation.mutate()}>{m.action_scan()}</Button>
	</div>
</header>

<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
	<div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
		{#each items as item (item.id)}
			<Card.Root class={['overflow-hidden', selectedItemId === item.id && 'ring-2 ring-cyan-400/50']}>
				<button class="block w-full text-left" onclick={() => selectItem(item)}>
					<div class="aspect-[2/3] bg-slate-900">
						{#if item.posterUrl}
							<img class="h-full w-full object-cover" src={item.posterUrl} alt={item.title || item.topLevelPath} />
						{:else}
							<div class="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
								{item.kind === 'folder' ? '文件夹' : '视频文件'}
							</div>
						{/if}
					</div>
				</button>
				<Card.Content class="flex flex-col gap-3 p-3">
					<div>
						<div class="line-clamp-2 text-sm font-medium text-slate-100">{item.title || item.topLevelPath}</div>
						<div class="mt-1 text-xs text-slate-500">
							{item.year || ''} · {item.videoFileCount} 个视频
						</div>
					</div>
					<span class={['inline-flex w-fit rounded px-2 py-1 text-xs', statusClass(item.status)]}>
						{statusText(item.status, item.reviewReason)}
					</span>
					{#if item.nonCompliantFileCount}
						<span class="text-xs text-amber-300">有待整理文件：{item.nonCompliantFileCount}</span>
					{/if}
					{#if canManualMatch(item)}
						<div class="flex flex-col gap-2">
							<input
								class="w-full rounded-md border border-slate-700 bg-slate-900 text-sm text-slate-100 placeholder:text-slate-500"
								placeholder="搜索 TMDB"
								bind:value={manualSearch[item.id]}
							/>
							<Button size="sm" variant="outline" onclick={() => searchItem(item)}>{m.action_manual_match()}</Button>
							{#each searchResults[item.id] || item.recognitionCandidates || [] as result (result.id)}
								<button
									class="w-full rounded-md bg-slate-900 p-2 text-left text-xs text-slate-200 hover:bg-slate-800"
									onclick={() => chooseIdentity(item, result)}
								>
									{result.title} {result.year ? `(${result.year})` : ''}
								</button>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		{:else}
			<Card.Root>
				<Card.Header>
					<Card.Title>还没有条目</Card.Title>
					<Card.Description>扫描这个 Library Path 后会显示一级文件夹和一级视频文件。</Card.Description>
				</Card.Header>
			</Card.Root>
		{/each}
	</div>

	<aside class="flex flex-col gap-4">
		<Card.Root>
			<Card.Header>
				<Card.Title>{selectedItem ? selectedItem.title || selectedItem.topLevelPath : 'Item Detail'}</Card.Title>
				<Card.Description>实时读取远端文件，扫描统计只作为摘要。</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				{#if selectedItem}
					<div class="flex flex-wrap gap-2">
						{#if canScanItem(selectedItem)}
							<Button size="sm" variant="outline" onclick={() => scanItemMutation.mutate(selectedItem)}>{m.action_scan()}</Button>
						{/if}
						{#if canCreatePlan(selectedItem)}
							<Button size="sm" onclick={() => createDraftMutation.mutate(selectedItem)}>{m.action_view_plan()}</Button>
						{/if}
					</div>
					{#if detailQuery.data}
						<div class="grid grid-cols-3 gap-2 text-xs text-slate-300">
							<div class="rounded-md bg-slate-900 p-2">视频 {detailQuery.data.summary.videoFileCount}</div>
							<div class="rounded-md bg-slate-900 p-2">符合 {detailQuery.data.summary.compliantFileCount ?? 0}</div>
							<div class="rounded-md bg-slate-900 p-2">待整理 {detailQuery.data.summary.nonCompliantFileCount ?? 0}</div>
						</div>
						<div class="max-h-[360px] overflow-auto rounded-md border border-slate-800">
							<table class="w-full text-left text-xs">
								<thead class="bg-slate-900 text-slate-400">
									<tr>
										<th class="px-3 py-2 font-medium">文件</th>
										<th class="px-3 py-2 font-medium">类型</th>
										<th class="px-3 py-2 font-medium">状态</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-800">
									{#each detailQuery.data.files as file (file.path)}
										<tr>
											<td class="px-3 py-2 text-slate-200">{file.basename}</td>
											<td class="px-3 py-2 text-slate-400">{file.type}</td>
											<td class="px-3 py-2 text-slate-400">{file.compliance.state}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else if detailQuery.isFetching}
						<div class="text-sm text-slate-500">正在读取 WebDAV...</div>
					{/if}
				{:else}
					<div class="text-sm text-slate-500">选择一个海报查看文件。</div>
				{/if}
			</Card.Content>
		</Card.Root>

		{#if draftQuery.data}
			<Card.Root>
				<Card.Header>
					<Card.Title>整理计划</Card.Title>
					<Card.Description>目标路径由 identity、映射和命名模板计算，不能直接编辑。</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-3">
					<div class="max-h-[420px] overflow-auto rounded-md border border-slate-800">
						<table class="w-full text-left text-xs">
							<thead class="bg-slate-900 text-slate-400">
								<tr>
									<th class="px-3 py-2 font-medium">选中</th>
									<th class="px-3 py-2 font-medium">Source</th>
									<th class="px-3 py-2 font-medium">Mapping</th>
									<th class="px-3 py-2 font-medium">Target</th>
									<th class="px-3 py-2 font-medium">冲突</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-800">
								{#each draftQuery.data.rows as row (row.id)}
									<tr>
										<td class="px-3 py-2">
											<input type="checkbox" bind:checked={row.selected} onchange={() => updateDraftMutation.mutate(row)} />
										</td>
										<td class="max-w-[160px] truncate px-3 py-2 text-slate-200">{row.sourceFilePath}</td>
										<td class="px-3 py-2">
											{#if row.mediaKind === 'tv'}
												<div class="flex gap-2">
													<input class="w-14 rounded border-slate-700 bg-slate-900" type="number" min="1" bind:value={row.season} onchange={() => updateDraftMutation.mutate(row)} />
													<input class="w-14 rounded border-slate-700 bg-slate-900" type="number" min="1" bind:value={row.episode} onchange={() => updateDraftMutation.mutate(row)} />
												</div>
											{:else}
												<span class="text-slate-500">movie</span>
											{/if}
										</td>
										<td class="max-w-[180px] truncate px-3 py-2 text-slate-300">{row.targetFilePath || row.errorCode}</td>
										<td class="px-3 py-2">
											{#if row.conflict}
												<label class="flex items-center gap-2 text-amber-300">
													<input type="checkbox" checked={row.conflictAction === 'overwrite'} onchange={(event) => {
														row.conflictAction = event.currentTarget.checked ? 'overwrite' : null;
														updateDraftMutation.mutate(row);
													}} />
													覆盖
												</label>
											{:else}
												<span class="text-slate-500">无</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<Button disabled={busy()} onclick={submitDraft}>{m.action_submit()}</Button>
				</Card.Content>
			</Card.Root>
		{/if}
	</aside>
</div>
