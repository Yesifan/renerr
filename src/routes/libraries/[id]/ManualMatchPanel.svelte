<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { Item, TmdbResult } from '$lib/schemas/domain';

	type Props = {
		item: Item;
		query: string;
		results: TmdbResult[];
		searchLabel: string;
		busy: boolean;
		onQueryChange: (value: string) => void;
		onSearch: (item: Item) => void | Promise<void>;
		onChoose: (item: Item, result: TmdbResult) => void | Promise<void>;
	};

	let { item, query, results, searchLabel, busy, onQueryChange, onSearch, onChoose }: Props =
		$props();
</script>

<div class="flex flex-col gap-4">
	<div class="flex gap-2">
		<Input
			value={query}
			placeholder="输入 title 或 TMDB id"
			oninput={(event) => onQueryChange(event.currentTarget.value)}
		/>
		<Button variant="outline" disabled={busy} onclick={() => onSearch(item)}>{searchLabel}</Button>
	</div>

	<div class="grid gap-2">
		{#if results.length}
			{#each results as result (result.id)}
				<Button
					variant="outline"
					class="h-auto justify-start whitespace-normal rounded-md p-3 text-left"
					disabled={busy}
					onclick={() => onChoose(item, result)}
				>
					<div>
						<div class="text-sm font-medium text-foreground">{result.title}</div>
						<div class="mt-1 text-xs text-muted-foreground">
							{result.originalTitle}
							{#if result.year}
								· {result.year}
							{/if}
						</div>
					</div>
				</Button>
			{/each}
		{:else}
			<div class="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
				没有扫描候选。输入 title 或 TMDB id 后搜索。
			</div>
		{/if}
	</div>
</div>
