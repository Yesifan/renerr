<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import AsyncCombobox from '$lib/components/AsyncCombobox.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import * as Select from '$lib/components/ui/select';
	import {
		filterDirectorySuggestions,
		joinRemotePath,
		pathQueryParts,
		type DirectorySuggestion
	} from '$lib/client/path-suggestions';
	import { messages as m } from '$lib/i18n';
	import type { MediaType, Source } from '$lib/schemas/domain';

	type LibraryForm = {
		sourceId: string;
		path: string;
		organizeTargetPath: string | null;
		mediaType: MediaType;
		autoOrganize: boolean;
	};

	type Props = {
		open: boolean;
		form: LibraryForm;
		sources: Source[];
		busy: boolean;
		testLabel: string;
		onSave: () => void | Promise<void>;
		onTest: () => void | Promise<void>;
		onTestTarget: () => void | Promise<void>;
		onLoadPathSuggestions: (sourceId: string, parentPath: string) => Promise<DirectorySuggestion[]>;
	};

	let {
		open = $bindable(),
		form = $bindable(),
		sources,
		busy,
		testLabel,
		onSave,
		onTest,
		onTestTarget,
		onLoadPathSuggestions
	}: Props = $props();

	type SuggestionState = {
		sourceId: string;
		parentPath: string;
		loading: boolean;
		loaded: boolean;
		error: string;
		options: DirectorySuggestion[];
	};

	function emptySuggestionState(): SuggestionState {
		return {
			sourceId: '',
			parentPath: '',
			loading: false,
			loaded: false,
			error: '',
			options: []
		};
	}

	let suggestions = $state<SuggestionState>({
		sourceId: '',
		parentPath: '',
		loading: false,
		loaded: false,
		error: '',
		options: []
	});
	let targetSuggestions = $state<SuggestionState>(emptySuggestionState());

	const mediaTypeLabels: Record<LibraryForm['mediaType'], string> = {
		tv: '电视剧',
		movie: '电影'
	};

	const selectedSourceName = $derived(
		sources.find((source) => source.id === form.sourceId)?.name ?? '选择媒体源'
	);

	const pathQuery = $derived(pathQueryParts(form.path));
	const targetPathQuery = $derived(pathQueryParts(form.organizeTargetPath ?? '/'));
	const filteredSuggestions = $derived.by(() => {
		if (suggestions.sourceId !== form.sourceId || suggestions.parentPath !== pathQuery.parentPath)
			return [];
		return filterDirectorySuggestions(suggestions.options, pathQuery.basename);
	});
	const filteredTargetSuggestions = $derived.by(() => {
		if (
			targetSuggestions.sourceId !== form.sourceId ||
			targetSuggestions.parentPath !== targetPathQuery.parentPath
		)
			return [];
		return filterDirectorySuggestions(targetSuggestions.options, targetPathQuery.basename);
	});

	async function loadSuggestions(retry = false) {
		if (!form.sourceId) return;
		const parentPath = pathQuery.parentPath;
		const sameQuery =
			suggestions.sourceId === form.sourceId && suggestions.parentPath === parentPath;
		if (sameQuery && (suggestions.loading || (suggestions.loaded && !retry))) return;
		suggestions = {
			sourceId: form.sourceId,
			parentPath,
			loading: true,
			loaded: false,
			error: '',
			options: sameQuery ? suggestions.options : []
		};
		try {
			suggestions = {
				sourceId: form.sourceId,
				parentPath,
				loading: false,
				loaded: true,
				error: '',
				options: await onLoadPathSuggestions(form.sourceId, parentPath)
			};
		} catch (error) {
			suggestions = {
				sourceId: form.sourceId,
				parentPath,
				loading: false,
				loaded: false,
				error: String(error),
				options: []
			};
		}
	}

	function updatePath(value: string) {
		form.path = value;
		void loadSuggestions();
	}

	function chooseSuggestion(option: DirectorySuggestion) {
		form.path = joinRemotePath(pathQuery.parentPath, option.basename);
	}

	async function loadTargetSuggestions(retry = false) {
		if (!form.sourceId || form.organizeTargetPath === null) return;
		const parentPath = targetPathQuery.parentPath;
		const sameQuery =
			targetSuggestions.sourceId === form.sourceId && targetSuggestions.parentPath === parentPath;
		if (sameQuery && (targetSuggestions.loading || (targetSuggestions.loaded && !retry))) return;
		targetSuggestions = {
			sourceId: form.sourceId,
			parentPath,
			loading: true,
			loaded: false,
			error: '',
			options: sameQuery ? targetSuggestions.options : []
		};
		try {
			targetSuggestions = {
				sourceId: form.sourceId,
				parentPath,
				loading: false,
				loaded: true,
				error: '',
				options: await onLoadPathSuggestions(form.sourceId, parentPath)
			};
		} catch (error) {
			targetSuggestions = {
				sourceId: form.sourceId,
				parentPath,
				loading: false,
				loaded: false,
				error: String(error),
				options: []
			};
		}
	}

	function updateTargetPath(value: string) {
		form.organizeTargetPath = value;
		void loadTargetSuggestions();
	}

	function chooseTargetSuggestion(option: DirectorySuggestion) {
		form.organizeTargetPath = joinRemotePath(targetPathQuery.parentPath, option.basename);
	}

	function toggleTargetPath(enabled: boolean) {
		form.organizeTargetPath = enabled ? form.organizeTargetPath || '/' : null;
		targetSuggestions = emptySuggestionState();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>添加 Library Path</Dialog.Title>
			<Dialog.Description>选择 WebDAV 来源中的管理根路径，并指定媒体类型。</Dialog.Description>
		</Dialog.Header>

		<Field.Group>
			<Field.Field>
				<Field.Label>媒体源</Field.Label>
				<Select.Root type="single" bind:value={form.sourceId}>
					<Select.Trigger class="w-full">{selectedSourceName}</Select.Trigger>
					<Select.Content>
						<Select.Group>
							{#each sources as source (source.id)}
								<Select.Item value={source.id}>{source.name}</Select.Item>
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</Field.Field>

			<Field.Field>
				<Field.Label for="library-path">路径</Field.Label>
				<AsyncCombobox
					id="library-path"
					value={form.path}
					options={filteredSuggestions}
					loading={suggestions.loading}
					loaded={suggestions.loaded}
					error={suggestions.error}
					placeholder="/tv"
					emptyText={form.sourceId ? '没有匹配目录，可手动输入。' : '选择媒体源后可浏览目录候选。'}
					loadingText="正在加载目录候选..."
					errorText="目录候选不可用，仍可手动输入。"
					idleText={form.sourceId ? '聚焦输入框加载当前目录候选。' : '选择媒体源后可浏览目录候选。'}
					getKey={(option) => option.basename}
					getLabel={(option) => joinRemotePath(pathQuery.parentPath, option.basename)}
					onInput={updatePath}
					onFocus={() => loadSuggestions()}
					onSelect={chooseSuggestion}
				>
					{#snippet option(option)}
						<span class="min-w-0 truncate font-mono text-[11px]">
							{joinRemotePath(pathQuery.parentPath, option.basename)}
						</span>
					{/snippet}
				</AsyncCombobox>
			</Field.Field>

			<Field.Field>
				<Field.Label>媒体类型</Field.Label>
				<Select.Root type="single" bind:value={form.mediaType}>
					<Select.Trigger class="w-full">{mediaTypeLabels[form.mediaType]}</Select.Trigger>
					<Select.Content>
						<Select.Group>
							<Select.Item value="tv">电视剧</Select.Item>
							<Select.Item value="movie">电影</Select.Item>
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</Field.Field>

			<Field.Field orientation="horizontal">
				<Checkbox id="library-auto-organize" bind:checked={form.autoOrganize} />
				<Field.Label for="library-auto-organize">自动整理高置信条目</Field.Label>
			</Field.Field>

			<Field.Field orientation="horizontal">
				<Checkbox
					id="library-use-target-path"
					checked={form.organizeTargetPath !== null}
					onCheckedChange={(checked) => toggleTargetPath(Boolean(checked))}
				/>
				<div class="grid gap-1">
					<Field.Label for="library-use-target-path">{m.library_path_target_enable()}</Field.Label>
					<Field.Description>
						{form.organizeTargetPath !== null
							? m.library_path_target_hint()
							: m.library_path_target_disabled_hint()}
					</Field.Description>
				</div>
			</Field.Field>

			{#if form.organizeTargetPath !== null}
				<Field.Field>
					<Field.Label for="library-target-path">{m.library_path_target_label()}</Field.Label>
					<AsyncCombobox
						id="library-target-path"
						value={form.organizeTargetPath}
						options={filteredTargetSuggestions}
						loading={targetSuggestions.loading}
						loaded={targetSuggestions.loaded}
						error={targetSuggestions.error}
						placeholder={m.library_path_target_placeholder()}
						emptyText={form.sourceId
							? m.library_path_target_empty_text()
							: m.library_path_target_choose_source_text()}
						loadingText={m.library_path_target_loading_text()}
						errorText={m.library_path_target_error_text()}
						idleText={form.sourceId
							? m.library_path_target_idle_text()
							: m.library_path_target_choose_source_text()}
						getKey={(option) => option.basename}
						getLabel={(option) => joinRemotePath(targetPathQuery.parentPath, option.basename)}
						onInput={updateTargetPath}
						onFocus={() => loadTargetSuggestions()}
						onSelect={chooseTargetSuggestion}
					>
						{#snippet option(option)}
							<span class="min-w-0 truncate font-mono text-[11px]">
								{joinRemotePath(targetPathQuery.parentPath, option.basename)}
							</span>
						{/snippet}
					</AsyncCombobox>
				</Field.Field>
			{/if}
		</Field.Group>

		<Dialog.Footer class="justify-between sm:justify-between">
			<div class="flex flex-wrap gap-2">
				<Button variant="outline" disabled={busy || !form.sourceId || !form.path} onclick={onTest}>
					{testLabel}
				</Button>
				{#if form.organizeTargetPath !== null}
					<Button
						variant="outline"
						disabled={busy || !form.sourceId || !form.organizeTargetPath}
						onclick={onTestTarget}
					>
						{m.action_test_target_path()}
					</Button>
				{/if}
			</div>
			<div class="flex gap-2">
				<Button variant="outline" disabled={busy} onclick={() => (open = false)}>取消</Button>
				<Button disabled={busy} onclick={onSave}>保存</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
