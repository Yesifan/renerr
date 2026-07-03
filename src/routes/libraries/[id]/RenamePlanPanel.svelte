<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import type { RenamePlanDraft, RenamePlanDraftRow, TmdbResult } from '$lib/schemas/domain';

	type Props = {
		draft: RenamePlanDraft;
		busy: boolean;
		submitLabel: string;
		onUpdateRow: (row: RenamePlanDraftRow) => void | Promise<void>;
		onSubmit: () => void | Promise<void>;
		onSearchMedia: (query: string) => Promise<TmdbResult[]>;
	};

	let { draft, busy, submitLabel, onUpdateRow, onSubmit, onSearchMedia }: Props = $props();

	let step = $state<'edit' | 'confirm'>('edit');
	let activeRowId = $state<string | null>(null);
	let rowQuery = $state('');
	let rowResults = $state<TmdbResult[]>([]);
	let rowSearchBusy = $state(false);
	let rowSearchError = $state('');

	const selectedRows = $derived(draft.rows.filter((row) => row.selected));
	const validSelectedRows = $derived(selectedRows.filter((row) => row.status === 'valid'));
	const noopRows = $derived(draft.rows.filter((row) => row.noop));
	const hasInvalidSelectedRows = $derived(selectedRows.some((row) => row.status === 'invalid'));
	const unresolvedConflicts = $derived(
		selectedRows.filter((row) => row.conflict && row.conflictAction !== 'overwrite').length
	);
	const mediaGroups = $derived.by(() => {
		const groups: { key: string; row: RenamePlanDraftRow }[] = [];
		for (const row of validSelectedRows) {
			const key = `${row.mediaKind}:${row.sourceMediaId}:${row.title}:${row.year ?? ''}`;
			if (!groups.some((group) => group.key === key)) groups.push({ key, row });
		}
		return groups.map((group) => group.row);
	});

	function updateSelected(row: RenamePlanDraftRow, checked: boolean | 'indeterminate') {
		if (row.noop) return;
		onUpdateRow({ ...row, selected: checked === true });
	}

	function updateOverwrite(row: RenamePlanDraftRow, checked: boolean | 'indeterminate') {
		onUpdateRow({ ...row, conflictAction: checked === true ? 'overwrite' : null });
	}

	function updateNumber(row: RenamePlanDraftRow, field: 'season' | 'episode', value: string) {
		const parsed = Number(value);
		onUpdateRow({
			...row,
			[field]: Number.isFinite(parsed) && parsed > 0 ? parsed : null
		});
	}

	function openRowSearch(row: RenamePlanDraftRow) {
		activeRowId = activeRowId === row.id ? null : row.id;
		rowQuery = row.title;
		rowResults = [];
		rowSearchError = '';
	}

	async function searchForRow() {
		if (!rowQuery.trim()) return;
		rowSearchBusy = true;
		rowSearchError = '';
		try {
			rowResults = await onSearchMedia(rowQuery);
		} catch (error) {
			rowSearchError = String(error);
			rowResults = [];
		} finally {
			rowSearchBusy = false;
		}
	}

	async function chooseRowMedia(row: RenamePlanDraftRow, result: TmdbResult) {
		await onUpdateRow({
			...row,
			sourceMediaId: String(result.id),
			title: result.title,
			originalTitle: result.originalTitle,
			year: result.year ?? null,
			posterPath: result.posterPath ?? null,
			posterUrl: null
		});
		activeRowId = null;
		rowResults = [];
	}
</script>

<div class="flex min-w-0 flex-col gap-4">
	<div class="flex flex-wrap gap-2 text-xs">
		<Badge variant="outline">共 {draft.rows.length} 个文件</Badge>
		<Badge variant="outline">已选 {selectedRows.length}</Badge>
		{#if noopRows.length}
			<Badge variant="outline" class="border-slate-500/30 bg-slate-500/15 text-slate-300"
				>跳过 {noopRows.length} 个无需整理</Badge
			>
		{/if}
		{#if hasInvalidSelectedRows}
			<Badge variant="outline" class="border-red-500/30 bg-red-500/15 text-red-300"
				>存在无效行</Badge
			>
		{/if}
		{#if unresolvedConflicts}
			<Badge variant="outline" class="border-amber-500/30 bg-amber-500/15 text-amber-300">
				{unresolvedConflicts} 个冲突未处理
			</Badge>
		{/if}
	</div>

	{#if step === 'edit'}
		<div class="max-h-[58vh] overflow-auto rounded-md border border-border">
			<Table.Root class="text-xs">
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-12">选中</Table.Head>
						<Table.Head>原始完整路径</Table.Head>
						<Table.Head>影视信息</Table.Head>
						<Table.Head>季/集</Table.Head>
						<Table.Head>冲突</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each draft.rows as row (row.id)}
						<Table.Row>
							<Table.Cell>
								<Checkbox
									checked={row.selected}
									disabled={row.noop}
									onCheckedChange={(checked) => updateSelected(row, checked)}
								/>
							</Table.Cell>
							<Table.Cell class="max-w-[360px] break-all font-mono text-[11px] text-foreground">
								<div>{row.sourceFilePath}</div>
								<div class="mt-2 border-t border-border/70 pt-2 text-muted-foreground">
									目标：{row.targetFilePath || row.errorCode}
								</div>
								{#if row.noop}
									<Badge
										variant="outline"
										class="mt-2 border-slate-500/30 bg-slate-500/15 text-slate-300">无需整理</Badge
									>
								{/if}
								{#if row.sidecars.length}
									<div class="mt-2 text-muted-foreground">
										Sidecar：
										{#each row.sidecars as sidecar (sidecar)}
											<div class="mt-1 break-all">{sidecar}</div>
										{/each}
									</div>
								{/if}
							</Table.Cell>
							<Table.Cell class="min-w-[260px]">
								<div class="flex min-w-0 items-start gap-3">
									<div class="h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
										{#if row.posterUrl}
											<img class="h-full w-full object-cover" src={row.posterUrl} alt={row.title} />
										{/if}
									</div>
									<div class="min-w-0 flex-1">
										<div class="truncate font-medium text-foreground">{row.title}</div>
										<div class="text-muted-foreground">{row.year ?? '年份未知'}</div>
										<Button
											class="mt-2 h-7 px-2 text-xs"
											variant="outline"
											onclick={() => openRowSearch(row)}
										>
											搜索 TMDB 修改
										</Button>
									</div>
								</div>
								{#if activeRowId === row.id}
									<div class="mt-3 rounded-md border border-border bg-background/70 p-3">
										<div class="flex gap-2">
											<Input
												value={rowQuery}
												placeholder="输入 title 或 TMDB id"
												oninput={(event) => (rowQuery = event.currentTarget.value)}
											/>
											<Button variant="outline" disabled={rowSearchBusy} onclick={searchForRow}
												>{rowSearchBusy ? '搜索中...' : '搜索'}</Button
											>
										</div>
										<div class="mt-2 grid gap-2">
											{#if rowSearchBusy}
												<div
													class="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground"
												>
													正在搜索 TMDB...
												</div>
											{:else if rowSearchError}
												<div
													class="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"
												>
													{rowSearchError}
												</div>
											{:else if rowResults.length}
												{#each rowResults as result (result.id)}
													<Button
														variant="outline"
														class="h-auto justify-start whitespace-normal rounded-md p-2 text-left text-xs"
														onclick={() => chooseRowMedia(row, result)}
													>
														{result.title}
														{result.year ? `(${result.year})` : ''}
													</Button>
												{/each}
											{:else}
												<div
													class="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground"
												>
													没有搜索结果。
												</div>
											{/if}
										</div>
									</div>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if row.mediaKind === 'tv'}
									<div class="flex gap-2">
										<Input
											class="w-16"
											type="number"
											min="1"
											value={row.season ?? ''}
											oninput={(event) => updateNumber(row, 'season', event.currentTarget.value)}
										/>
										<Input
											class="w-16"
											type="number"
											min="1"
											value={row.episode ?? ''}
											oninput={(event) => updateNumber(row, 'episode', event.currentTarget.value)}
										/>
									</div>
								{:else}
									<span class="text-muted-foreground">电影</span>
								{/if}
								{#if row.status === 'invalid'}
									<div class="mt-2 text-xs text-red-300">{row.errorCode}</div>
								{/if}
							</Table.Cell>
							<Table.Cell>
								{#if row.conflict}
									<label class="flex cursor-pointer items-center gap-2 text-amber-300">
										<Checkbox
											checked={row.conflictAction === 'overwrite'}
											onCheckedChange={(checked) => updateOverwrite(row, checked)}
										/>
										覆盖
									</label>
								{:else}
									<span class="text-muted-foreground">无</span>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex justify-end">
			<Button
				disabled={busy ||
					validSelectedRows.length === 0 ||
					hasInvalidSelectedRows ||
					unresolvedConflicts > 0}
				onclick={() => (step = 'confirm')}
			>
				下一步
			</Button>
		</div>
	{:else}
		<div class="rounded-md border border-border bg-muted/20 p-4">
			<div class="text-sm font-medium text-foreground">最终确认</div>
			<div class="mt-1 text-xs text-muted-foreground">
				将执行 {validSelectedRows.length} 个重命名，跳过 {noopRows.length} 个无需整理文件；请重点核对目标完整路径。
			</div>
		</div>

		<div class="grid gap-3 md:grid-cols-2">
			{#each mediaGroups as row (row.id)}
				<div class="flex min-w-0 gap-3 rounded-md border border-border bg-background/55 p-3">
					<div class="h-20 w-14 shrink-0 overflow-hidden rounded bg-muted">
						{#if row.posterUrl}
							<img class="h-full w-full object-cover" src={row.posterUrl} alt={row.title} />
						{/if}
					</div>
					<div class="min-w-0">
						<div class="line-clamp-2 text-sm font-medium text-foreground">{row.title}</div>
						<div class="mt-1 text-xs text-muted-foreground">
							{row.mediaKind === 'tv' ? '电视剧' : '电影'} · {row.year ?? '年份未知'}
						</div>
						<div class="mt-2 break-all font-mono text-[11px] text-muted-foreground">
							TMDB {row.sourceMediaId || '未指定'}
						</div>
					</div>
				</div>
			{/each}
		</div>

		<div class="max-h-[58vh] overflow-auto pr-1">
			<div class="grid gap-3">
				{#each validSelectedRows as row (row.id)}
					<div class="rounded-md border border-border bg-background/55 p-3">
						<div class="break-all font-mono text-xs font-medium text-foreground">
							{row.targetFilePath}
						</div>
						<div class="mt-2 break-all font-mono text-[11px] text-muted-foreground">
							from {row.sourceFilePath}
						</div>
						{#if row.conflictAction === 'overwrite'}
							<Badge
								variant="outline"
								class="mt-2 border-amber-500/30 bg-amber-500/15 text-amber-300">覆盖冲突</Badge
							>
						{/if}
						{#if row.sidecars.length}
							<div class="mt-2 text-[11px] text-muted-foreground">
								包含 {row.sidecars.length} 个 sidecar
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="flex justify-end gap-2">
			<Button variant="outline" disabled={busy} onclick={() => (step = 'edit')}>返回编辑</Button>
			<Button disabled={busy} onclick={onSubmit}>{submitLabel}</Button>
		</div>
	{/if}
</div>
