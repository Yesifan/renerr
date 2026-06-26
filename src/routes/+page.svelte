<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { resolve } from '$app/paths';
	import { api, libraryLabel, type Workspace } from '$lib/client/api';
	import { onMount } from 'svelte';

	let workspace = $state<Workspace>({
		sources: [],
		libraries: [],
		items: [],
		tasks: [],
		settings: { tmdbApiKey: '' }
	});
	let message = $state('');

	onMount(() => {
		void refresh();
	});

	async function refresh() {
		try {
			workspace = await api<Workspace>('/api/workspace');
		} catch (error) {
			message = String(error);
		}
	}

	function itemCount(libraryId: string) {
		return workspace.items.filter((item) => item.libraryPathId === libraryId).length;
	}
</script>

<svelte:head>
	<title>媒体库 - Renarr</title>
</svelte:head>

<header class="mb-6">
	<h1 class="text-2xl font-semibold text-slate-100">媒体库</h1>
	<p class="mt-1 text-sm text-slate-400">选择一个 library path 进入独立管理页面。</p>
</header>

{#if message}
	<div class="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
		{message}
	</div>
{/if}

<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
	{#each workspace.libraries as library (library.id)}
		<a href={resolve(`/libraries/${library.id}`)}>
			<Card.Root class="h-full transition hover:ring-cyan-400/40">
				<Card.Header>
					<Card.Title>{libraryLabel(library)}</Card.Title>
					<Card.Description>{library.mediaType === 'tv' ? '电视剧' : '电影'}媒体库</Card.Description>
				</Card.Header>
				<Card.Content class="text-sm text-slate-300">
					<div>{itemCount(library.id)} 个一级条目</div>
					<div class="mt-1">自动整理：{library.autoOrganize ? '开启' : '关闭'}</div>
				</Card.Content>
			</Card.Root>
		</a>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title>还没有媒体库</Card.Title>
				<Card.Description>先到设置页添加 WebDAV 来源和 Library Path。</Card.Description>
			</Card.Header>
			<Card.Content>
				<a class="text-sm text-cyan-300 hover:underline" href={resolve('/settings/media')}>前往媒体管理设置</a>
			</Card.Content>
		</Card.Root>
	{/each}
</div>
