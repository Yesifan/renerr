<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import {
		api,
		libraryLabel,
		post,
		statusClass,
		statusText,
		type Item,
		type Library,
		type TmdbResult,
		type Workspace
	} from '$lib/client/api';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	let workspace = $state<Workspace>({
		sources: [],
		libraries: [],
		items: [],
		tasks: [],
		settings: { tmdbApiKey: '' }
	});
	let message = $state('');
	let busy = $state(false);
	let manualSearch = $state<Record<string, string>>({});
	let searchResults = $state<Record<string, TmdbResult[]>>({});

	let library = $derived(workspace.libraries.find((entry) => entry.id === params.id) as Library | undefined);
	let items = $derived(workspace.items.filter((item) => item.libraryPathId === params.id));

	onMount(() => {
		void refresh();
		const timer = setInterval(() => void refresh(false), 2500);
		return () => clearInterval(timer);
	});

	async function refresh(showBusy = true) {
		if (showBusy) busy = true;
		try {
			workspace = await api<Workspace>('/api/workspace');
		} catch (error) {
			message = String(error);
		} finally {
			if (showBusy) busy = false;
		}
	}

	async function mutate<T>(action: () => Promise<T>) {
		busy = true;
		try {
			const result = await action();
			message = '操作已提交';
			await refresh(false);
			return result;
		} catch (error) {
			message = String(error);
			throw error;
		} finally {
			busy = false;
		}
	}

	async function scanLibrary() {
		await mutate(() => post(`/api/libraries/${params.id}/scan`));
	}

	async function searchItem(item: Item) {
		const query = manualSearch[item.id] || item.title || item.topLevelPath;
		const type = library?.mediaType || 'tv';
		searchResults[item.id] = await api<TmdbResult[]>(
			`/api/library-items/${item.id}/recognition/search?type=${type}&q=${encodeURIComponent(query)}`
		);
	}

	async function chooseIdentity(item: Item, result: TmdbResult) {
		await mutate(() =>
			post(`/api/library-items/${item.id}/recognize`, {
				sourceMediaType: library?.mediaType || 'tv',
				sourceMediaId: String(result.id),
				title: result.title,
				originalTitle: result.originalTitle,
				year: result.year,
				posterPath: result.posterPath
			})
		);
	}

	async function organizeItem(item: Item) {
		await mutate(async () => {
			const plan = await post<{ id: string }>(`/api/library-items/${item.id}/plan`);
			return post(`/api/rename-plans/${plan.id}/submit`);
		});
	}
</script>

<svelte:head>
	<title>{library ? libraryLabel(library) : '媒体库'} - Renarr</title>
</svelte:head>

<header class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-semibold text-slate-100">媒体库详情</h1>
		<p class="mt-1 text-sm text-slate-400">
			{library ? libraryLabel(library) : '正在加载'}
		</p>
	</div>
	<div class="flex items-center gap-3">
		{#if message}<span class="text-sm text-slate-400">{message}</span>{/if}
		<Button disabled={busy} onclick={() => refresh()} variant="outline">刷新</Button>
		<Button disabled={busy || !library} onclick={scanLibrary}>扫描</Button>
	</div>
</header>

<div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
	{#each items as item (item.id)}
		<Card.Root class="overflow-hidden">
			<div class="aspect-[2/3] bg-slate-900">
				{#if item.posterUrl}
					<img class="h-full w-full object-cover" src={item.posterUrl} alt={item.title || item.topLevelPath} />
				{:else}
					<div class="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
						{item.kind === 'folder' ? '文件夹' : '视频文件'}
					</div>
				{/if}
			</div>
			<Card.Content class="space-y-3 p-3">
				<div>
					<div class="line-clamp-2 text-sm font-medium text-slate-100">{item.title || item.topLevelPath}</div>
						<div class="mt-1 text-xs text-slate-500">
						{item.year || ''} · {item.videoFileCount} 个视频
					</div>
				</div>
				<span class={['inline-flex rounded px-2 py-1 text-xs', statusClass(item.status)]}>
					{statusText(item.status, item.reviewReason)}
				</span>
				{#if item.status === 'identified' || item.status === 'organized'}
					<Button class="w-full" size="sm" disabled={busy} onclick={() => organizeItem(item)}>
						生成计划并整理
					</Button>
				{:else}
					<div class="space-y-2">
						<input
							class="w-full rounded-md border border-slate-700 bg-slate-900 text-sm text-slate-100 placeholder:text-slate-500"
							placeholder="搜索 TMDB"
							bind:value={manualSearch[item.id]}
						/>
						<Button class="w-full" size="sm" variant="outline" onclick={() => searchItem(item)}>
							搜索/指定
						</Button>
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
