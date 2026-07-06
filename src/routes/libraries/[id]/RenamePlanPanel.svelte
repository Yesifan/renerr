<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import type {
		RenamePlanDraft,
		RenamePlanDraftRow,
		TmdbEpisodeOption,
		TmdbResult,
		TmdbSeasonOption
	} from '$lib/schemas/domain';

	type Props = {
		draft: RenamePlanDraft;
		busy: boolean;
		submitLabel: string;
		onUpdateRow: (row: RenamePlanDraftRow) => void | Promise<void>;
		onSubmit: () => void | Promise<void>;
		onSearchMedia: (query: string) => Promise<TmdbResult[]>;
		onLoadSeasonOptions: (tmdbId: string) => Promise<TmdbSeasonOption[]>;
		onLoadEpisodeOptions: (tmdbId: string, season: number) => Promise<TmdbEpisodeOption[]>;
	};

	let {
		draft,
		busy,
		submitLabel,
		onUpdateRow,
		onSubmit,
		onSearchMedia,
		onLoadSeasonOptions,
		onLoadEpisodeOptions
	}: Props = $props();

	let step = $state<'edit' | 'confirm'>('edit');
	let activeRowId = $state<string | null>(null);
	let rowQuery = $state('');
	let rowResults = $state<TmdbResult[]>([]);
	let rowSearchBusy = $state(false);
	let rowSearchError = $state('');
	let seasonStates = $state<Record<string, OptionState<TmdbSeasonOption>>>({});
	let episodeStates = $state<Record<string, OptionState<TmdbEpisodeOption>>>({});

	type OptionState<T> = {
		loading: boolean;
		loaded: boolean;
		error: string;
		options: T[];
	};

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
		if (!value.trim()) {
			onUpdateRow({ ...row, [field]: null });
			return;
		}
		const parsed = Number(value);
		const valid = field === 'season' ? parsed >= 0 : parsed > 0;
		const nextValue = Number.isInteger(parsed) && valid ? parsed : null;
		const nextRow = { ...row, [field]: nextValue };
		onUpdateRow({
			...nextRow
		});
		if (field === 'season' && nextValue !== null) void ensureEpisodeOptions(nextRow, true);
	}

	async function ensureSeasonOptions(row: RenamePlanDraftRow, retry = false) {
		if (row.mediaKind !== 'tv' || !row.sourceMediaId) return;
		const key = row.sourceMediaId;
		const state = seasonStates[key];
		if (state?.loading || (state?.loaded && !retry) || (state?.error && !retry)) return;
		seasonStates[key] = { loading: true, loaded: false, error: '', options: state?.options ?? [] };
		try {
			seasonStates[key] = {
				loading: false,
				loaded: true,
				error: '',
				options: await onLoadSeasonOptions(key)
			};
		} catch (error) {
			seasonStates[key] = { loading: false, loaded: false, error: String(error), options: [] };
		}
	}

	async function ensureEpisodeOptions(row: RenamePlanDraftRow, retry = false) {
		if (row.mediaKind !== 'tv' || !row.sourceMediaId || row.season === null) return;
		const key = episodeKey(row.sourceMediaId, row.season);
		const state = episodeStates[key];
		if (state?.loading || (state?.loaded && !retry) || (state?.error && !retry)) return;
		episodeStates[key] = { loading: true, loaded: false, error: '', options: state?.options ?? [] };
		try {
			episodeStates[key] = {
				loading: false,
				loaded: true,
				error: '',
				options: await onLoadEpisodeOptions(row.sourceMediaId, row.season)
			};
		} catch (error) {
			episodeStates[key] = { loading: false, loaded: false, error: String(error), options: [] };
		}
	}

	function seasonOptions(row: RenamePlanDraftRow) {
		const options = row.sourceMediaId ? (seasonStates[row.sourceMediaId]?.options ?? []) : [];
		if (row.season === null || options.some((option) => option.number === row.season))
			return options;
		return [
			...options,
			{ number: row.season, name: `当前值 S${row.season}`, episodeCount: null, airDate: null }
		].sort((a, b) => a.number - b.number);
	}

	function episodeOptions(row: RenamePlanDraftRow) {
		const options =
			row.sourceMediaId && row.season !== null
				? (episodeStates[episodeKey(row.sourceMediaId, row.season)]?.options ?? [])
				: [];
		if (row.episode === null || options.some((option) => option.episode === row.episode))
			return options;
		return [
			...options,
			{
				season: row.season ?? 0,
				episode: row.episode,
				name: `当前值 E${row.episode}`,
				airDate: null,
				overview: ''
			}
		].sort((a, b) => a.episode - b.episode);
	}

	function seasonState(row: RenamePlanDraftRow) {
		return row.sourceMediaId ? seasonStates[row.sourceMediaId] : undefined;
	}

	function episodeState(row: RenamePlanDraftRow) {
		return row.sourceMediaId && row.season !== null
			? episodeStates[episodeKey(row.sourceMediaId, row.season)]
			: undefined;
	}

	function episodeKey(tmdbId: string, season: number) {
		return `${tmdbId}:${season}`;
	}

	function seasonLabel(option: TmdbSeasonOption) {
		const count = option.episodeCount === null ? '' : ` · ${option.episodeCount} 集`;
		return `${option.name || `Season ${option.number}`}${count}`;
	}

	function episodeLabel(option: TmdbEpisodeOption) {
		return option.name ? `E${option.episode} · ${option.name}` : `E${option.episode}`;
	}

	function optionStatus(row: RenamePlanDraftRow) {
		const seasons = seasonState(row);
		const episodes = episodeState(row);
		if (seasons?.loading || episodes?.loading) return { tone: 'muted', text: '加载季集候选...' };
		if (seasons?.error) return { tone: 'error', text: '季候选不可用，仍可手动输入' };
		if (episodes?.error) return { tone: 'error', text: '集候选不可用，仍可手动输入' };
		if (seasons && seasons.options.length === 0)
			return { tone: 'muted', text: 'TMDB 没有季候选，可手动输入' };
		if (row.season !== null && episodes && episodes.options.length === 0)
			return { tone: 'muted', text: 'TMDB 没有集候选，可手动输入' };
		return { tone: 'muted', text: '可输入候选外数字' };
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
			posterUrl: result.posterUrl
		});
		activeRowId = null;
		rowResults = [];
		void ensureSeasonOptions({ ...row, sourceMediaId: String(result.id) }, true);
	}

	function remotePathParts(path: string) {
		const index = path.lastIndexOf('/');
		if (index < 0) return { directory: '', filename: path };
		return {
			directory: index === 0 ? '/' : path.slice(0, index),
			filename: path.slice(index + 1)
		};
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
							<Table.Cell class="max-w-[360px] font-mono text-[11px]">
								{@const sourcePath = remotePathParts(row.sourceFilePath)}
								{@const targetPath = remotePathParts(row.targetFilePath)}
								<div class="break-words text-xs font-medium text-foreground">
									{sourcePath.filename}
								</div>
								<div class="mt-1 break-all text-muted-foreground">{sourcePath.directory}</div>
								<div class="mt-2 border-t border-border/70 pt-2">
									<div class="break-words text-xs font-medium text-foreground">
										{targetPath.filename || row.errorCode}
									</div>
									<div class="mt-1 break-all text-muted-foreground">{targetPath.directory}</div>
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
														<div class="flex min-w-0 gap-2">
															<div class="h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
																{#if result.posterUrl}
																	<img
																		class="h-full w-full object-cover"
																		src={result.posterUrl}
																		alt={result.title}
																	/>
																{/if}
															</div>
															<div class="min-w-0">
																<div class="font-medium text-foreground">
																	{result.title}
																	{result.year ? ` (${result.year})` : ''}
																</div>
																{#if result.overview}
																	<div class="mt-1 line-clamp-2 text-muted-foreground">
																		{result.overview}
																	</div>
																{/if}
															</div>
														</div>
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
									<div class="grid gap-2">
										<div class="grid grid-cols-2 gap-2">
											<div>
												<label class="sr-only" for={`season-${row.id}`}>季</label>
												<Input
													id={`season-${row.id}`}
													class="w-20"
													type="number"
													min="0"
													list={`season-options-${row.id}`}
													value={row.season ?? ''}
													onfocus={() => ensureSeasonOptions(row, true)}
													oninput={(event) =>
														updateNumber(row, 'season', event.currentTarget.value)}
												/>
												<datalist id={`season-options-${row.id}`}>
													{#each seasonOptions(row) as option (option.number)}
														<option value={option.number}>{seasonLabel(option)}</option>
													{/each}
												</datalist>
											</div>
											<div>
												<label class="sr-only" for={`episode-${row.id}`}>集</label>
												<Input
													id={`episode-${row.id}`}
													class="w-20"
													type="number"
													min="1"
													list={`episode-options-${row.id}`}
													value={row.episode ?? ''}
													onfocus={() => ensureEpisodeOptions(row, true)}
													oninput={(event) =>
														updateNumber(row, 'episode', event.currentTarget.value)}
												/>
												<datalist id={`episode-options-${row.id}`}>
													{#each episodeOptions(row) as option (option.episode)}
														<option value={option.episode}>{episodeLabel(option)}</option>
													{/each}
												</datalist>
											</div>
										</div>
										<div class="min-h-4 text-[11px] text-muted-foreground">
											{#if optionStatus(row).tone === 'error'}
												<span class="text-red-300">{optionStatus(row).text}</span>
											{:else}
												{optionStatus(row).text}
											{/if}
										</div>
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
					{@const targetPath = remotePathParts(row.targetFilePath)}
					{@const sourcePath = remotePathParts(row.sourceFilePath)}
					<div class="rounded-md border border-border bg-background/55 p-3">
						<div class="break-words font-mono text-xs font-medium text-foreground">
							{targetPath.filename}
						</div>
						<div class="mt-2 break-all font-mono text-[11px] text-muted-foreground">
							{targetPath.directory}
						</div>
						<div class="mt-3 border-t border-border/70 pt-2">
							<div class="break-words font-mono text-[11px] text-muted-foreground">
								from {sourcePath.filename}
							</div>
							<div class="mt-1 break-all font-mono text-[11px] text-muted-foreground">
								{sourcePath.directory}
							</div>
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
