<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { Item, TmdbResult } from '$lib/schemas/domain';

	type Props = {
		item: Item;
		query: string;
		results: TmdbResult[];
		searchLabel: string;
		onQueryChange: (value: string) => void;
		onSearch: (item: Item) => void | Promise<void>;
		onChoose: (item: Item, result: TmdbResult) => void | Promise<void>;
	};

	let { item, query, results, searchLabel, onQueryChange, onSearch, onChoose }: Props = $props();
</script>

<div class="flex flex-col gap-2">
	<Input
		value={query}
		placeholder="搜索 TMDB"
		oninput={(event) => onQueryChange(event.currentTarget.value)}
	/>
	<Button size="sm" variant="outline" onclick={() => onSearch(item)}>{searchLabel}</Button>
	{#each results as result (result.id)}
		<Button
			variant="outline"
			class="h-auto justify-start whitespace-normal rounded-xl p-2 text-left text-xs"
			onclick={() => onChoose(item, result)}
		>
			{result.title} {result.year ? `(${result.year})` : ''}
		</Button>
	{/each}
</div>
