<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { resolve } from '$app/paths';
	import { libraryLabel } from '$lib/client/formatters';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function itemCount(libraryId: string) {
		return data.itemCounts[libraryId] ?? 0;
	}
</script>

<svelte:head>
	<title>媒体库 - Renarr</title>
</svelte:head>

<PageHeader title="媒体库" description="选择一个 library path 进入独立管理页面。" />

<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
	{#each data.libraries as library (library.id)}
		<a href={resolve(`/libraries/${library.id}`)}>
			<Card.Root class="h-full transition hover:ring-primary/40">
				<Card.Header>
					<Card.Title>{libraryLabel(library)}</Card.Title>
					<Card.Description>{library.mediaType === 'tv' ? '电视剧' : '电影'}媒体库</Card.Description
					>
				</Card.Header>
				<Card.Content class="flex flex-col gap-2 text-sm text-muted-foreground">
					<div>{itemCount(library.id)} 个一级条目</div>
					<Badge variant="outline" class="w-fit">
						自动整理：{library.autoOrganize ? '开启' : '关闭'}
					</Badge>
				</Card.Content>
			</Card.Root>
		</a>
	{:else}
		<Empty.Root class="col-span-full">
			<Empty.Header>
				<Empty.Title>还没有媒体库</Empty.Title>
				<Empty.Description>先到设置页添加 WebDAV 来源和 Library Path。</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button href={resolve('/settings/media')} variant="outline">前往媒体管理设置</Button>
			</Empty.Content>
		</Empty.Root>
	{/each}
</div>
