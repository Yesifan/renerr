<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { statusClass, statusText } from '$lib/client/formatters';
	import type { Item, Library } from '$lib/schemas/domain';

	type Props = {
		item: Item;
		library: Library;
	};

	let { item, library }: Props = $props();

	const displayTitle = $derived(item.title || item.topLevelPath);
	const fullPath = $derived(`${library.path.replace(/\/$/, '')}/${item.topLevelPath.replace(/^\//, '')}`);
	const stats = $derived([
		{ label: '视频', value: item.videoFileCount },
		{ label: '符合', value: item.compliantFileCount ?? 0 },
		{ label: '待整理', value: item.nonCompliantFileCount ?? 0 }
	]);
</script>

<section class="-mx-4 border-y border-border bg-background md:-mx-6 lg:-mx-8">
	<div class="relative overflow-hidden">
		{#if item.posterUrl}
			<img class="absolute inset-0 h-full w-full scale-105 object-cover opacity-20 blur-sm" src={item.posterUrl} alt="" />
		{/if}
		<div class="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/70"></div>

		<div class="relative grid gap-8 px-4 py-6 md:grid-cols-[180px_minmax(0,1fr)] md:px-6 md:py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
			<div class="max-w-[220px]">
				<div class="aspect-[2/3] overflow-hidden rounded-md bg-muted">
					{#if item.posterUrl}
						<img class="h-full w-full object-cover" src={item.posterUrl} alt={displayTitle} />
					{:else}
						<div class="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
							{item.kind === 'folder' ? '文件夹' : '视频文件'}
						</div>
					{/if}
				</div>
			</div>

			<div class="flex min-w-0 flex-col justify-end gap-7">
				<div class="flex flex-wrap gap-2">
					<Badge variant="outline" class={statusClass(item.status)}>
						{statusText(item.status, item.reviewReason)}
					</Badge>
					<Badge variant="outline">{library.mediaType === 'tv' ? '电视剧' : '电影'}</Badge>
					{#if item.year}
						<Badge variant="outline">{item.year}</Badge>
					{/if}
				</div>

				<div class="min-w-0">
					<h1 class="max-w-[18ch] text-3xl font-semibold leading-tight text-foreground text-balance md:text-5xl">
						{displayTitle}
					</h1>
					{#if item.title && item.topLevelPath !== item.title}
						<p class="mt-3 break-all font-mono text-xs text-muted-foreground">{item.topLevelPath}</p>
					{/if}
				</div>

				<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
					<div class="min-w-0 border-t border-border pt-4">
						<div class="text-xs text-muted-foreground">完整路径</div>
						<div class="mt-2 break-all font-mono text-sm text-foreground">{fullPath}</div>
					</div>

					<div class="grid grid-cols-3 divide-x divide-border border-y border-border">
						{#each stats as stat (stat.label)}
							<div class="px-4 py-3">
								<div class="text-xs text-muted-foreground">{stat.label}</div>
								<div class="mt-1 text-xl font-semibold text-foreground">{stat.value}</div>
							</div>
						{/each}
					</div>
				</div>

				<div class="grid gap-4 border-t border-border pt-4 text-sm md:grid-cols-3">
					<div class="min-w-0">
						<div class="text-xs text-muted-foreground">来源</div>
						<div class="mt-1 text-foreground">{item.source || '未指定'}</div>
					</div>
					<div class="min-w-0">
						<div class="text-xs text-muted-foreground">TMDB ID</div>
						<div class="mt-1 font-mono text-foreground">{item.sourceMediaId || '未指定'}</div>
					</div>
					<div class="min-w-0">
						<div class="text-xs text-muted-foreground">最近扫描</div>
						<div class="mt-1 text-foreground">{item.lastScannedAt || '暂无记录'}</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
