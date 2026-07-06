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
		searchBusy?: boolean;
		searchError?: string;
		onQueryChange: (value: string) => void;
		onSearch: (item: Item) => void | Promise<void>;
		onChoose: (item: Item, result: TmdbResult) => void | Promise<void>;
	};

	let {
		item,
		query,
		results,
		searchLabel,
		busy,
		searchBusy = false,
		searchError = '',
		onQueryChange,
		onSearch,
		onChoose
	}: Props = $props();
</script>

<div class="flex flex-col gap-4">
	<div class="flex gap-2">
		<Input
			value={query}
			placeholder="输入 title 或 TMDB id"
			oninput={(event) => onQueryChange(event.currentTarget.value)}
		/>
		<Button variant="outline" disabled={busy || searchBusy} onclick={() => onSearch(item)}>
			{searchBusy ? '搜索中...' : searchLabel}
		</Button>
	</div>

	<div class="grid gap-2">
		{#if searchBusy}
			<div class="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
				正在搜索 TMDB...
			</div>
		{:else if searchError}
			<div class="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
				{searchError}
			</div>
		{:else if results.length}
			{#each results as result (result.id)}
				<Button
					variant="outline"
					class="h-auto justify-start whitespace-normal rounded-md p-3 text-left"
					disabled={busy}
					onclick={() => onChoose(item, result)}
				>
					<div class="flex min-w-0 gap-3">
						<div class="h-20 w-14 shrink-0 overflow-hidden rounded bg-muted">
							{#if result.posterUrl}
								<img class="h-full w-full object-cover" src={result.posterUrl} alt={result.title} />
							{/if}
						</div>
						<div class="min-w-0">
							<div class="text-sm font-medium text-foreground">{result.title}</div>
							<div class="mt-1 text-xs text-muted-foreground">
								{result.originalTitle}
								{#if result.year}
									· {result.year}
								{/if}
							</div>
							{#if result.overview}
								<div class="mt-2 line-clamp-2 text-xs text-muted-foreground">
									{result.overview}
								</div>
							{/if}
						</div>
					</div>
				</Button>
			{/each}
		{:else}
			<div class="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
				没有候选结果。输入 title 或 TMDB id 后搜索。
			</div>
		{/if}
	</div>
</div>
