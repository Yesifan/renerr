<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { statusClass, statusText } from '$lib/client/formatters';
	import type { Item, TmdbResult } from '$lib/schemas/domain';
	import ManualMatchPanel from './ManualMatchPanel.svelte';

	type Props = {
		item: Item;
		selected: boolean;
		canManualMatch: boolean;
		manualQuery: string;
		searchResults: TmdbResult[];
		searchLabel: string;
		onSelect: (item: Item) => void;
		onManualQueryChange: (item: Item, value: string) => void;
		onSearch: (item: Item) => void | Promise<void>;
		onChooseIdentity: (item: Item, result: TmdbResult) => void | Promise<void>;
	};

	let {
		item,
		selected,
		canManualMatch,
		manualQuery,
		searchResults,
		searchLabel,
		onSelect,
		onManualQueryChange,
		onSearch,
		onChooseIdentity
	}: Props = $props();

	const results = $derived(searchResults.length ? searchResults : item.recognitionCandidates || []);
</script>

<Card.Root class={['overflow-hidden', selected && 'ring-2 ring-primary/50']}>
	<button class="block w-full text-left" onclick={() => onSelect(item)}>
		<div class="aspect-[2/3] bg-muted">
			{#if item.posterUrl}
				<img class="h-full w-full object-cover" src={item.posterUrl} alt={item.title || item.topLevelPath} />
			{:else}
				<div class="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
					{item.kind === 'folder' ? '文件夹' : '视频文件'}
				</div>
			{/if}
		</div>
	</button>
	<Card.Content class="flex flex-col gap-3 p-3">
		<div>
			<div class="line-clamp-2 text-sm font-medium text-foreground">{item.title || item.topLevelPath}</div>
			<div class="mt-1 text-xs text-muted-foreground">
				{item.year || ''} · {item.videoFileCount} 个视频
			</div>
		</div>
		<Badge variant="outline" class={statusClass(item.status)}>
			{statusText(item.status, item.reviewReason)}
		</Badge>
		{#if item.nonCompliantFileCount}
			<Badge variant="outline" class="border-amber-500/30 bg-amber-500/15 text-amber-300">
				有待整理文件：{item.nonCompliantFileCount}
			</Badge>
		{/if}
		{#if canManualMatch}
			<ManualMatchPanel
				{item}
				query={manualQuery}
				{results}
				{searchLabel}
				onQueryChange={(value) => onManualQueryChange(item, value)}
				onSearch={onSearch}
				onChoose={onChooseIdentity}
			/>
		{/if}
	</Card.Content>
</Card.Root>
