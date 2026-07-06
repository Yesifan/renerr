<script lang="ts">
	import { Combobox } from 'bits-ui';
	import { tick } from 'svelte';
	import {
		findEpisodeMappingOption,
		formatEpisodeMappingDisplayLabel,
		formatEpisodeMappingInput,
		formatEpisodeMappingPreview,
		parseEpisodeMappingInput,
		type EpisodeMapping
	} from '$lib/client/episode-mapping';
	import type { TmdbEpisodeOption, TmdbSeasonOption } from '$lib/schemas/domain';
	import { cn } from '$lib/utils';

	type Props = {
		id: string;
		sourceKey: string | null;
		season: number | null;
		episode: number | null;
		seasonOptions: TmdbSeasonOption[];
		seasonLoading?: boolean;
		seasonError?: string;
		disabled?: boolean;
		onLoadSeasons: () => void;
		onLoadEpisodes: (season: number) => Promise<TmdbEpisodeOption[]>;
		onCommit: (mapping: EpisodeMapping) => void | Promise<void>;
		onInvalidChange: (invalid: boolean) => void;
	};

	let {
		id,
		sourceKey,
		season,
		episode,
		seasonOptions,
		seasonLoading = false,
		seasonError = '',
		disabled = false,
		onLoadSeasons,
		onLoadEpisodes,
		onCommit,
		onInvalidChange
	}: Props = $props();

	let open = $state(false);
	let selectedValue = $state('');
	let loadedEpisodeKey = $state('');
	let episodeLoading = $state(false);
	let episodeError = $state('');
	let episodeOptions = $state<TmdbEpisodeOption[]>([]);
	let focused = $state(false);

	const committedInput = $derived(formatEpisodeMappingInput(season, episode));
	let inputValue = $state('');
	const parseResult = $derived(parseEpisodeMappingInput(inputValue));
	const localInvalid = $derived(parseResult.status === 'invalid' && inputValue !== committedInput);
	const committedPreview = $derived(
		season === null || episode === null ? '' : formatEpisodeMappingPreview({ season, episode })
	);
	const committedMapping = $derived(
		season === null || episode === null ? null : { season, episode }
	);
	const localPreview = $derived(
		parseResult.status === 'valid' ? formatEpisodeMappingPreview(parseResult.mapping) : ''
	);
	const seasonCandidateMode = $derived(!inputValue.includes('/'));
	const parsedSeasonForEpisodes = $derived.by(() => {
		const [rawSeason = ''] = inputValue.trim().split('/');
		if (!rawSeason || !/^\d+$/.test(rawSeason)) return null;
		return Number(rawSeason);
	});
	const activeEpisodeKey = $derived(
		sourceKey && parsedSeasonForEpisodes !== null ? `${sourceKey}:${parsedSeasonForEpisodes}` : ''
	);
	const activeEpisodeOptions = $derived(
		loadedEpisodeKey === activeEpisodeKey ? episodeOptions : []
	);
	const activeEpisodeError = $derived(loadedEpisodeKey === activeEpisodeKey ? episodeError : '');
	const committedEpisodeKey = $derived(
		sourceKey && season !== null ? `${sourceKey}:${season}` : ''
	);
	const committedEpisodeOptions = $derived(
		loadedEpisodeKey === committedEpisodeKey ? episodeOptions : []
	);
	const committedEpisodeOption = $derived(
		findEpisodeMappingOption(committedEpisodeOptions, committedMapping)
	);
	const blurredInputValue = $derived(
		formatEpisodeMappingDisplayLabel(committedMapping, committedEpisodeOption)
	);
	const visibleInputValue = $derived(focused ? inputValue : blurredInputValue);
	const currentOptions = $derived.by(() =>
		seasonCandidateMode
			? seasonOptions.map((option) => ({
					key: `season:${option.number}`,
					label: seasonLabel(option),
					kind: 'season' as const,
					option
				}))
			: activeEpisodeOptions.map((option) => ({
					key: `episode:${option.season}:${option.episode}`,
					label: episodeLabel(option),
					kind: 'episode' as const,
					option
				}))
	);
	const candidateStatus = $derived.by(() => {
		if (seasonCandidateMode && seasonLoading) return 'loading';
		if (!seasonCandidateMode && episodeLoading) return 'loading';
		if (seasonCandidateMode && seasonError) return 'error';
		if (!seasonCandidateMode && activeEpisodeError) return 'error';
		if (!seasonCandidateMode && parsedSeasonForEpisodes === null) return 'invalid-season';
		return currentOptions.length ? 'ready' : 'empty';
	});

	function handleFocus() {
		focused = true;
		inputValue = committedInput;
		open = true;
		onLoadSeasons();
		if (parsedSeasonForEpisodes !== null && !seasonCandidateMode) {
			void loadEpisodes(parsedSeasonForEpisodes);
		}
	}

	function handleBlur() {
		focused = false;
	}

	function handleInput(event: Event) {
		const next = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : '';
		inputValue = next;
		selectedValue = '';
		open = true;
		onLoadSeasons();
		const parsed = parseEpisodeMappingInput(next);
		if (parsed.status === 'valid') {
			onInvalidChange(false);
			void loadEpisodes(parsed.mapping.season);
			void onCommit(parsed.mapping);
			return;
		}

		onInvalidChange(true);
		if (parsedSeasonForEpisodes !== null && next.includes('/')) {
			void loadEpisodes(parsedSeasonForEpisodes);
		}
	}

	function handleSelectedValueChange(next: string) {
		selectedValue = next;
		const selected = currentOptions.find((option) => option.key === next);
		if (!selected) return;

		if (selected.kind === 'season') {
			const selectedSeason = selected.option.number;
			inputValue = `${selectedSeason}/`;
			focused = true;
			selectedValue = '';
			onInvalidChange(true);
			void loadEpisodes(selectedSeason);
			void keepEpisodeOptionsOpen();
			return;
		}

		const mapping = {
			season: selected.option.season,
			episode: selected.option.episode
		};
		inputValue = formatEpisodeMappingInput(mapping.season, mapping.episode);
		open = false;
		onInvalidChange(false);
		void onCommit(mapping);
	}

	async function keepEpisodeOptionsOpen() {
		await tick();
		open = true;
	}

	function seasonLabel(option: TmdbSeasonOption) {
		const count = option.episodeCount === null ? '' : ` · ${option.episodeCount} 集`;
		return `${option.name || `Season ${option.number}`}${count}`;
	}

	function episodeLabel(option: TmdbEpisodeOption) {
		return option.name
			? `S${option.season}E${option.episode} · ${option.name}`
			: `S${option.season}E${option.episode}`;
	}

	async function loadEpisodes(nextSeason: number) {
		if (!sourceKey) return;
		const nextKey = `${sourceKey}:${nextSeason}`;
		if (episodeLoading || loadedEpisodeKey === nextKey) return;
		episodeLoading = true;
		episodeError = '';
		try {
			episodeOptions = await onLoadEpisodes(nextSeason);
			loadedEpisodeKey = nextKey;
		} catch (error) {
			episodeOptions = [];
			episodeError = String(error);
			loadedEpisodeKey = nextKey;
		} finally {
			episodeLoading = false;
		}
	}
</script>

<div class="grid min-w-[12rem] gap-1.5">
	<Combobox.Root
		type="single"
		bind:open
		value={selectedValue}
		onValueChange={handleSelectedValueChange}
		inputValue={visibleInputValue}
		{disabled}
	>
		<Combobox.Input
			{id}
			class={cn(
				'bg-input border-border focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-9 w-full min-w-0 rounded-4xl border px-3 py-1 font-mono text-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-[3px] aria-invalid:ring-[3px] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
				localInvalid && 'border-red-500/60 ring-2 ring-red-500/20'
			)}
			placeholder="1/1"
			autocomplete="off"
			aria-invalid={localInvalid ? 'true' : undefined}
			onfocus={handleFocus}
			onblur={handleBlur}
			oninput={handleInput}
		>
			{#snippet child({ props })}
				<input {...props} value={visibleInputValue} />
			{/snippet}
		</Combobox.Input>
		<Combobox.Portal>
			<Combobox.Content
				sideOffset={4}
				class="bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/5 relative z-50 max-h-[min(20rem,52vh)] min-w-[min(24rem,calc(100vw-2rem))] overflow-x-hidden overflow-y-auto rounded-2xl p-1 shadow-2xl ring-1 duration-100"
			>
				<Combobox.Viewport>
					{#if candidateStatus === 'loading'}
						<div class="px-3 py-2 text-xs text-muted-foreground">正在加载 TMDB 候选...</div>
					{:else if candidateStatus === 'error'}
						<div class="px-3 py-2 text-xs text-red-300">
							{seasonCandidateMode
								? '季候选不可用，仍可手动输入。'
								: '集候选不可用，仍可手动输入。'}
						</div>
					{:else if candidateStatus === 'invalid-season'}
						<div class="px-3 py-2 text-xs text-muted-foreground">先输入合法季号。</div>
					{:else if candidateStatus === 'empty'}
						<div class="px-3 py-2 text-xs text-muted-foreground">
							{seasonCandidateMode ? '没有季候选，可手动输入。' : '没有集候选，可手动输入。'}
						</div>
					{:else}
						{#each currentOptions as candidate (candidate.key)}
							<Combobox.Item
								value={candidate.key}
								label={candidate.label}
								class="focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex min-h-12 w-full cursor-default items-start rounded-xl px-3 py-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
							>
								{#if candidate.kind === 'season'}
									<div class="min-w-0">
										<div class="font-medium text-foreground">
											第 {candidate.option.number} 季 · {candidate.option.name || '未命名季'}
										</div>
										<div class="mt-0.5 text-xs text-muted-foreground">
											{candidate.option.episodeCount === null
												? '集数未知'
												: `${candidate.option.episodeCount} 集`}
											{candidate.option.airDate ? ` · ${candidate.option.airDate}` : ''}
										</div>
									</div>
								{:else}
									<div class="min-w-0">
										<div class="font-medium text-foreground">
											S{String(candidate.option.season).padStart(2, '0')}E{String(
												candidate.option.episode
											).padStart(2, '0')}
											{candidate.option.name ? ` · ${candidate.option.name}` : ''}
										</div>
										<div class="mt-0.5 text-xs text-muted-foreground">
											第 {candidate.option.season} 季第 {candidate.option.episode} 集
											{candidate.option.airDate ? ` · ${candidate.option.airDate}` : ''}
										</div>
										{#if candidate.option.overview}
											<div class="mt-1 line-clamp-2 text-xs text-muted-foreground">
												{candidate.option.overview}
											</div>
										{/if}
									</div>
								{/if}
							</Combobox.Item>
						{/each}
					{/if}
				</Combobox.Viewport>
			</Combobox.Content>
		</Combobox.Portal>
	</Combobox.Root>
	<div class="min-h-4 text-[11px]">
		{#if localInvalid}
			<span class="text-red-300">输入完整季/集，例如 1/1。</span>
		{:else if localPreview}
			<span class="font-mono text-foreground">{localPreview}</span>
		{:else if committedPreview}
			<span class="font-mono text-foreground">{committedPreview}</span>
		{:else}
			<span class="text-muted-foreground">输入 season/episode</span>
		{/if}
	</div>
</div>
