<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import type { Item, TmdbResult } from '$lib/schemas/domain';
	import LibraryItemCard from './LibraryItemCard.svelte';

	type Props = {
		items: Item[];
		selectedItemId: string | null;
		manualSearch: Record<string, string>;
		searchResults: Record<string, TmdbResult[]>;
		searchLabel: string;
		onSelect: (item: Item) => void;
		canManualMatch: (item: Item) => boolean;
		onManualQueryChange: (item: Item, value: string) => void;
		onSearch: (item: Item) => void | Promise<void>;
		onChooseIdentity: (item: Item, result: TmdbResult) => void | Promise<void>;
	};

	let {
		items,
		selectedItemId,
		manualSearch,
		searchResults,
		searchLabel,
		onSelect,
		canManualMatch,
		onManualQueryChange,
		onSearch,
		onChooseIdentity
	}: Props = $props();
</script>

<div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
	{#each items as item (item.id)}
		<LibraryItemCard
			{item}
			selected={selectedItemId === item.id}
			canManualMatch={canManualMatch(item)}
			manualQuery={manualSearch[item.id] || ''}
			searchResults={searchResults[item.id] || []}
			{searchLabel}
			onSelect={onSelect}
			onManualQueryChange={onManualQueryChange}
			onSearch={onSearch}
			onChooseIdentity={onChooseIdentity}
		/>
	{:else}
		<Empty.Root class="col-span-full">
			<Empty.Header>
				<Empty.Title>还没有条目</Empty.Title>
				<Empty.Description>扫描这个 Library Path 后会显示一级文件夹和一级视频文件。</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button variant="outline" disabled>等待扫描</Button>
			</Empty.Content>
		</Empty.Root>
	{/each}
</div>
