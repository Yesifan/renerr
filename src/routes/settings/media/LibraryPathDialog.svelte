<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import {
		filterDirectorySuggestions,
		joinRemotePath,
		pathQueryParts,
		type DirectorySuggestion
	} from '$lib/client/path-suggestions';
	import type { MediaType, Source } from '$lib/schemas/domain';

	type LibraryForm = {
		sourceId: string;
		path: string;
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
		onLoadPathSuggestions
	}: Props = $props();

	let suggestions = $state<{
		sourceId: string;
		parentPath: string;
		loading: boolean;
		loaded: boolean;
		error: string;
		options: DirectorySuggestion[];
	}>({
		sourceId: '',
		parentPath: '',
		loading: false,
		loaded: false,
		error: '',
		options: []
	});

	const mediaTypeLabels: Record<LibraryForm['mediaType'], string> = {
		tv: '电视剧',
		movie: '电影'
	};

	const selectedSourceName = $derived(
		sources.find((source) => source.id === form.sourceId)?.name ?? '选择媒体源'
	);

	const pathQuery = $derived(pathQueryParts(form.path));
	const filteredSuggestions = $derived.by(() => {
		if (suggestions.sourceId !== form.sourceId || suggestions.parentPath !== pathQuery.parentPath)
			return [];
		return filterDirectorySuggestions(suggestions.options, pathQuery.basename);
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
				<Input
					id="library-path"
					value={form.path}
					placeholder="/tv"
					onfocus={() => loadSuggestions()}
					oninput={(event) => updatePath(event.currentTarget.value)}
				/>
				<div class="mt-2 min-h-6 text-xs text-muted-foreground">
					{#if !form.sourceId}
						选择媒体源后可浏览目录候选。
					{:else if suggestions.sourceId !== form.sourceId && suggestions.loaded}
						聚焦输入框加载当前媒体源目录候选。
					{:else if suggestions.loading}
						正在加载目录候选...
					{:else if suggestions.error}
						<span class="text-red-300">目录候选不可用，仍可手动输入。</span>
					{:else if suggestions.loaded && filteredSuggestions.length === 0}
						没有匹配目录，可手动输入。
					{:else if suggestions.loaded}
						<div class="grid gap-1">
							{#each filteredSuggestions as option (option.basename)}
								<button
									type="button"
									class="rounded-md border border-border bg-muted/20 px-3 py-2 text-left font-mono text-[11px] text-foreground transition-colors hover:bg-muted/40"
									onclick={() => chooseSuggestion(option)}
								>
									{joinRemotePath(pathQuery.parentPath, option.basename)}
								</button>
							{/each}
						</div>
					{:else}
						聚焦输入框加载当前目录候选。
					{/if}
				</div>
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
		</Field.Group>

		<Dialog.Footer class="justify-between sm:justify-between">
			<Button variant="outline" disabled={busy || !form.sourceId || !form.path} onclick={onTest}>
				{testLabel}
			</Button>
			<div class="flex gap-2">
				<Button variant="outline" disabled={busy} onclick={() => (open = false)}>取消</Button>
				<Button disabled={busy} onclick={onSave}>保存</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
