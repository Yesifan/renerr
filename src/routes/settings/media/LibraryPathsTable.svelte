<script lang="ts">
	import { resolve } from '$app/paths';
	import AsyncCombobox from '$lib/components/AsyncCombobox.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import { Switch } from '$lib/components/ui/switch';
	import * as Table from '$lib/components/ui/table';
	import { libraryLabel } from '$lib/client/formatters';
	import {
		filterDirectorySuggestions,
		joinRemotePath,
		pathQueryParts,
		type DirectorySuggestion
	} from '$lib/client/path-suggestions';
	import { messages as m } from '$lib/i18n';
	import type { Library } from '$lib/schemas/domain';

	type Props = {
		libraries: Library[];
		busy: boolean;
		onAdd: () => void;
		onToggleAutoOrganize: (library: Library, autoOrganize: boolean) => void | Promise<void>;
		onUpdateOrganizeTarget: (
			library: Library,
			organizeTargetPath: string | null
		) => void | Promise<void>;
		onTestOrganizeTarget: (library: Library, organizeTargetPath: string) => void | Promise<void>;
		onLoadPathSuggestions: (sourceId: string, parentPath: string) => Promise<DirectorySuggestion[]>;
	};

	let {
		libraries,
		busy,
		onAdd,
		onToggleAutoOrganize,
		onUpdateOrganizeTarget,
		onTestOrganizeTarget,
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

	let editingLibraryId = $state<string | null>(null);
	let editUseTarget = $state(false);
	let editTargetPath = $state('/');
	let suggestions = $state<SuggestionState>(emptySuggestionState());

	const editingLibrary = $derived(
		libraries.find((library) => library.id === editingLibraryId) ?? null
	);
	const targetPathQuery = $derived(pathQueryParts(editTargetPath));
	const filteredSuggestions = $derived.by(() => {
		if (
			!editingLibrary ||
			suggestions.sourceId !== editingLibrary.sourceId ||
			suggestions.parentPath !== targetPathQuery.parentPath
		)
			return [];
		return filterDirectorySuggestions(suggestions.options, targetPathQuery.basename);
	});

	function startEdit(library: Library) {
		editingLibraryId = library.id;
		editUseTarget = Boolean(library.organizeTargetPath);
		editTargetPath = library.organizeTargetPath || '/';
		suggestions = emptySuggestionState();
	}

	function cancelEdit() {
		editingLibraryId = null;
		editUseTarget = false;
		editTargetPath = '/';
		suggestions = emptySuggestionState();
	}

	function toggleEditTarget(enabled: boolean) {
		editUseTarget = enabled;
		if (enabled && !editTargetPath) editTargetPath = '/';
		suggestions = emptySuggestionState();
	}

	async function loadSuggestions(retry = false) {
		if (!editingLibrary || !editUseTarget) return;
		const parentPath = targetPathQuery.parentPath;
		const sameQuery =
			suggestions.sourceId === editingLibrary.sourceId && suggestions.parentPath === parentPath;
		if (sameQuery && (suggestions.loading || (suggestions.loaded && !retry))) return;
		suggestions = {
			sourceId: editingLibrary.sourceId,
			parentPath,
			loading: true,
			loaded: false,
			error: '',
			options: sameQuery ? suggestions.options : []
		};
		try {
			suggestions = {
				sourceId: editingLibrary.sourceId,
				parentPath,
				loading: false,
				loaded: true,
				error: '',
				options: await onLoadPathSuggestions(editingLibrary.sourceId, parentPath)
			};
		} catch (error) {
			suggestions = {
				sourceId: editingLibrary.sourceId,
				parentPath,
				loading: false,
				loaded: false,
				error: String(error),
				options: []
			};
		}
	}

	function updateTargetPath(value: string) {
		editTargetPath = value;
		void loadSuggestions();
	}

	function chooseSuggestion(option: DirectorySuggestion) {
		editTargetPath = joinRemotePath(targetPathQuery.parentPath, option.basename);
	}

	async function saveEdit(library: Library) {
		await onUpdateOrganizeTarget(library, editUseTarget ? editTargetPath : null);
		cancelEdit();
	}

	async function testEditTarget(library: Library) {
		await onTestOrganizeTarget(library, editTargetPath);
	}
</script>

{#if libraries.length}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>路径</Table.Head>
				<Table.Head>类型</Table.Head>
				<Table.Head>自动整理</Table.Head>
				<Table.Head>{m.library_path_target_column()}</Table.Head>
				<Table.Head>操作</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each libraries as library (library.id)}
				<Table.Row>
					<Table.Cell class="font-medium text-foreground">{libraryLabel(library)}</Table.Cell>
					<Table.Cell>{library.mediaType === 'tv' ? '电视剧' : '电影'}</Table.Cell>
					<Table.Cell>
						<label class="inline-flex items-center gap-2">
							<Switch
								size="sm"
								checked={library.autoOrganize}
								disabled={busy}
								onclick={() => onToggleAutoOrganize(library, !library.autoOrganize)}
							/>
							<span>{library.autoOrganize ? '开启' : '关闭'}</span>
						</label>
					</Table.Cell>
					<Table.Cell>
						{#if editingLibraryId === library.id}
							<div class="grid min-w-60 gap-2">
								<label class="inline-flex items-center gap-2">
									<Switch
										size="sm"
										checked={editUseTarget}
										disabled={busy}
										onclick={() => toggleEditTarget(!editUseTarget)}
									/>
									<span>{m.library_path_target_enable()}</span>
								</label>
								{#if editUseTarget}
									<AsyncCombobox
										id={`library-target-path-${library.id}`}
										value={editTargetPath}
										options={filteredSuggestions}
										loading={suggestions.loading}
										loaded={suggestions.loaded}
										error={suggestions.error}
										placeholder={m.library_path_target_placeholder()}
										emptyText={m.library_path_target_empty_text()}
										loadingText={m.library_path_target_loading_text()}
										errorText={m.library_path_target_error_text()}
										idleText={m.library_path_target_idle_text()}
										getKey={(option) => option.basename}
										getLabel={(option) =>
											joinRemotePath(targetPathQuery.parentPath, option.basename)}
										onInput={updateTargetPath}
										onFocus={() => loadSuggestions()}
										onSelect={chooseSuggestion}
									>
										{#snippet option(option)}
											<span class="min-w-0 truncate font-mono text-[11px]">
												{joinRemotePath(targetPathQuery.parentPath, option.basename)}
											</span>
										{/snippet}
									</AsyncCombobox>
								{:else}
									<p class="text-xs text-muted-foreground">
										{m.library_path_target_disabled_hint()}
									</p>
								{/if}
							</div>
						{:else}
							<span
								class={library.organizeTargetPath ? 'font-mono text-xs' : 'text-muted-foreground'}
							>
								{library.organizeTargetPath || m.library_path_target_same_as_source()}
							</span>
						{/if}
					</Table.Cell>
					<Table.Cell>
						{#if editingLibraryId === library.id}
							<div class="flex flex-wrap gap-2">
								{#if editUseTarget}
									<Button
										variant="outline"
										size="sm"
										disabled={busy || !editTargetPath}
										onclick={() => testEditTarget(library)}
									>
										{m.action_test_target_path()}
									</Button>
								{/if}
								<Button
									size="sm"
									disabled={busy || (editUseTarget && !editTargetPath)}
									onclick={() => saveEdit(library)}
								>
									{m.action_save()}
								</Button>
								<Button variant="outline" size="sm" disabled={busy} onclick={cancelEdit}>
									{m.action_cancel()}
								</Button>
							</div>
						{:else}
							<div class="flex flex-wrap gap-3">
								<Button
									variant="link"
									href={resolve(`/libraries/${library.id}`)}
									class="h-auto px-0"
								>
									{m.action_open()}
								</Button>
								<Button
									variant="link"
									class="h-auto px-0"
									disabled={busy}
									onclick={() => startEdit(library)}
								>
									{m.action_edit()}
								</Button>
							</div>
						{/if}
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else}
	<Empty.Root>
		<Empty.Header>
			<Empty.Title>暂无 Library Path</Empty.Title>
			<Empty.Description>添加一个 WebDAV Library Path 后可以开始扫描媒体库。</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			<Button onclick={onAdd}>添加 Library Path</Button>
		</Empty.Content>
	</Empty.Root>
{/if}
