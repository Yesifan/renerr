<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Modal from '$lib/components/Modal.svelte';
	import SectionPanel from '$lib/components/SectionPanel.svelte';
	import { api, libraryLabel, post, put, type Library, type Source, type Workspace } from '$lib/client/api';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	let workspace = $state<Workspace>({
		sources: [],
		libraries: [],
		items: [],
		tasks: [],
		settings: { tmdbApiKey: '' }
	});
	let message = $state('');
	let busy = $state(false);
	let addLibraryOpen = $state(false);
	let addSourceOpen = $state(false);
	let tmdbApiKey = $state('');
	let namingLanguage = $state('zh-CN');
	let metadataEnabled = $state(true);
	let libraryForm = $state({
		sourceId: '',
		path: '/',
		mediaType: 'tv' as 'movie' | 'tv',
		autoOrganize: false
	});
	let sourceForm = $state({
		name: '',
		url: '',
		username: '',
		credential: ''
	});

	onMount(() => {
		void refresh();
	});

	async function refresh() {
		busy = true;
		try {
			workspace = await api<Workspace>('/api/workspace');
			libraryForm.sourceId ||= workspace.sources[0]?.id || '';
			namingLanguage = workspace.settings.namingLanguage || 'zh-CN';
			metadataEnabled = workspace.settings.metadataEnabled ?? true;
		} catch (error) {
			message = String(error);
		} finally {
			busy = false;
		}
	}

	async function saveTmdbSettings() {
		busy = true;
		try {
			await put('/api/settings', {
				tmdbApiKey
			});
			tmdbApiKey = '';
			message = '元数据配置已保存';
			await refresh();
		} catch (error) {
			message = String(error);
		} finally {
			busy = false;
		}
	}

	async function saveFileSettings() {
		busy = true;
		try {
			await put('/api/settings', {
				namingLanguage,
				metadataEnabled
			});
			message = '文件管理设置已保存';
			await refresh();
		} catch (error) {
			message = String(error);
		} finally {
			busy = false;
		}
	}

	async function saveLibrary() {
		busy = true;
		try {
			await post<Library>('/api/libraries', libraryForm);
			addLibraryOpen = false;
			libraryForm = {
				sourceId: workspace.sources[0]?.id || '',
				path: '/',
				mediaType: 'tv',
				autoOrganize: false
			};
			message = '媒体库路径已添加';
			await refresh();
		} catch (error) {
			message = String(error);
		} finally {
			busy = false;
		}
	}

	async function toggleAutoOrganize(library: Library, autoOrganize: boolean) {
		busy = true;
		try {
			await put<Library>(`/api/libraries/${library.id}`, { autoOrganize });
			message = autoOrganize ? '已开启自动整理' : '已关闭自动整理';
			await refresh();
		} catch (error) {
			message = String(error);
		} finally {
			busy = false;
		}
	}

	async function testSource() {
		busy = true;
		try {
			await post('/api/webdav/test', sourceForm);
			message = '连接测试成功';
		} catch (error) {
			message = String(error);
		} finally {
			busy = false;
		}
	}

	async function saveSource() {
		busy = true;
		try {
			await post<Source>('/api/sources', sourceForm);
			addSourceOpen = false;
			sourceForm = { name: '', url: '', username: '', credential: '' };
			message = '媒体源已添加';
			await refresh();
		} catch (error) {
			message = String(error);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>媒体管理 - Renarr</title>
</svelte:head>

<header class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-semibold text-slate-100">媒体管理</h1>
		<p class="mt-1 text-sm text-slate-400">集中管理元数据、命名、媒体源和 Library Path。</p>
	</div>
	<div class="flex items-center gap-3">
		{#if message}<span class="text-sm text-slate-400">{message}</span>{/if}
		<Button disabled={busy} onclick={refresh} variant="outline">刷新</Button>
	</div>
</header>

<div class="space-y-6">
	<SectionPanel title="元数据配置" description="配置外部元数据服务。">
		<div class="grid gap-5 lg:grid-cols-[220px_1fr]">
			<div class="text-sm font-medium text-slate-200">TMDB API Key</div>
			<div class="space-y-2">
				<input
					class="w-full rounded-md border border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500"
					placeholder="输入新的 TMDB API Key"
					bind:value={tmdbApiKey}
				/>
				<div class="text-xs text-slate-500">当前: {workspace.settings.tmdbApiKey || '未设置'}</div>
			</div>
		</div>
		<div class="mt-5 flex justify-end">
			<Button disabled={busy || !tmdbApiKey} onclick={saveTmdbSettings}>保存元数据配置</Button>
		</div>
	</SectionPanel>

	<SectionPanel title="文件管理" description="控制整理后的命名和本地元数据文件输出。">
		<div class="grid gap-5 lg:grid-cols-[220px_1fr]">
			<div class="text-sm font-medium text-slate-200">命名语言</div>
			<select class="w-full rounded-md border border-slate-700 bg-slate-900 text-slate-100" bind:value={namingLanguage}>
				<option value="zh-CN">中文优先</option>
				<option value="en-US">英文优先</option>
			</select>

			<div class="text-sm font-medium text-slate-200">NFO 元数据</div>
			<label class="flex items-center gap-2 text-sm text-slate-300">
				<input type="checkbox" bind:checked={metadataEnabled} />
				整理成功后生成基础 NFO 和 poster
			</label>
		</div>
		<div class="mt-5 flex justify-end">
			<Button disabled={busy} onclick={saveFileSettings}>保存文件管理设置</Button>
		</div>
	</SectionPanel>

	<SectionPanel title="Library Paths" description="每个路径是一个独立的媒体库管理入口。">
		{#snippet actions()}
			<Button onclick={() => (addLibraryOpen = true)}>添加 Library Path</Button>
		{/snippet}

		<div class="overflow-hidden rounded-md border border-slate-800">
			<table class="w-full text-left text-sm">
				<thead class="bg-slate-900 text-slate-400">
					<tr>
						<th class="px-4 py-3 font-medium">路径</th>
						<th class="px-4 py-3 font-medium">类型</th>
						<th class="px-4 py-3 font-medium">自动整理</th>
						<th class="px-4 py-3 font-medium">操作</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800 bg-slate-950/60">
					{#each workspace.libraries as library (library.id)}
						<tr>
							<td class="px-4 py-3 font-medium text-slate-100">{libraryLabel(library)}</td>
							<td class="px-4 py-3 text-slate-300">{library.mediaType === 'tv' ? '电视剧' : '电影'}</td>
							<td class="px-4 py-3">
								<label class="inline-flex items-center gap-2 text-slate-300">
									<input
										class="peer sr-only"
										type="checkbox"
										checked={library.autoOrganize}
										disabled={busy}
										onchange={(event) => toggleAutoOrganize(library, event.currentTarget.checked)}
									/>
									<span
										class="h-5 w-9 rounded-full bg-slate-700 p-0.5 transition peer-checked:bg-cyan-500 peer-disabled:opacity-50"
										aria-hidden="true"
									>
										<span class={['block h-4 w-4 rounded-full bg-white transition', library.autoOrganize && 'translate-x-4']}></span>
									</span>
									<span>{library.autoOrganize ? '开启' : '关闭'}</span>
								</label>
							</td>
							<td class="px-4 py-3">
								<a class="text-cyan-300 hover:underline" href={resolve(`/libraries/${library.id}`)}>打开</a>
							</td>
						</tr>
					{:else}
						<tr>
							<td class="px-4 py-6 text-slate-500" colspan="4">暂无 Library Path。</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</SectionPanel>

	<SectionPanel title="媒体源" description="管理 WebDAV 来源和认证信息。">
		{#snippet actions()}
			<Button onclick={() => (addSourceOpen = true)}>添加媒体源</Button>
		{/snippet}

		<div class="overflow-hidden rounded-md border border-slate-800">
			<table class="w-full text-left text-sm">
				<thead class="bg-slate-900 text-slate-400">
					<tr>
						<th class="px-4 py-3 font-medium">名称</th>
						<th class="px-4 py-3 font-medium">URL</th>
						<th class="px-4 py-3 font-medium">用户名</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800 bg-slate-950/60">
					{#each workspace.sources as source (source.id)}
						<tr>
							<td class="px-4 py-3 font-medium text-slate-100">{source.name}</td>
							<td class="px-4 py-3 text-slate-300">{source.url}</td>
							<td class="px-4 py-3 text-slate-300">{source.username}</td>
						</tr>
					{:else}
						<tr>
							<td class="px-4 py-6 text-slate-500" colspan="3">暂无媒体源。</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</SectionPanel>
</div>

<Modal
	open={addLibraryOpen}
	title="添加 Library Path"
	description="选择 WebDAV 来源中的管理根路径，并指定媒体类型。"
	busy={busy}
	onclose={() => (addLibraryOpen = false)}
	onconfirm={saveLibrary}
>
	<label class="block text-sm">
		<span class="text-slate-300">媒体源</span>
		<select class="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 text-slate-100" bind:value={libraryForm.sourceId}>
			{#each workspace.sources as source (source.id)}
				<option value={source.id}>{source.name}</option>
			{/each}
		</select>
	</label>
	<label class="block text-sm">
		<span class="text-slate-300">路径</span>
		<input class="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 text-slate-100" bind:value={libraryForm.path} />
	</label>
	<label class="block text-sm">
		<span class="text-slate-300">媒体类型</span>
		<select class="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 text-slate-100" bind:value={libraryForm.mediaType}>
			<option value="tv">电视剧</option>
			<option value="movie">电影</option>
		</select>
	</label>
	<label class="flex items-center gap-2 text-sm text-slate-300">
		<input type="checkbox" bind:checked={libraryForm.autoOrganize} />
		自动整理高置信条目
	</label>
</Modal>

<Modal
	open={addSourceOpen}
	title="添加媒体源"
	description="连接测试只验证认证和目录读取，不会写入远端文件。"
	confirmLabel="保存媒体源"
	busy={busy}
	onclose={() => (addSourceOpen = false)}
	onconfirm={saveSource}
>
	<label class="block text-sm">
		<span class="text-slate-300">名称</span>
		<input class="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 text-slate-100" bind:value={sourceForm.name} />
	</label>
	<label class="block text-sm">
		<span class="text-slate-300">URL</span>
		<input class="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 text-slate-100" bind:value={sourceForm.url} />
	</label>
	<label class="block text-sm">
		<span class="text-slate-300">用户名</span>
		<input class="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 text-slate-100" bind:value={sourceForm.username} />
	</label>
	<label class="block text-sm">
		<span class="text-slate-300">密码或 token</span>
		<input
			class="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 text-slate-100"
			type="password"
			bind:value={sourceForm.credential}
		/>
	</label>
	<div class="flex justify-start">
		<Button variant="outline" disabled={busy} onclick={testSource}>测试连接</Button>
	</div>
</Modal>
