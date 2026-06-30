<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SectionPanel from '$lib/components/SectionPanel.svelte';
	import FileManagementSettingsForm from './FileManagementSettingsForm.svelte';
	import LibraryPathDialog from './LibraryPathDialog.svelte';
	import LibraryPathsTable from './LibraryPathsTable.svelte';
	import MetadataSettingsForm from './MetadataSettingsForm.svelte';
	import SourceDialog from './SourceDialog.svelte';
	import SourcesTable from './SourcesTable.svelte';
	import { api, post, put } from '$lib/client/api';
	import { messages as m } from '$lib/i18n';
	import type { Library, PublicSettings, Source } from '$lib/schemas/domain';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let refreshedData = $state<{
		sources: Source[];
		libraries: Library[];
		settings: PublicSettings;
	} | null>(null);
	let workspace = $derived(
		refreshedData ?? {
			sources: data.sources,
			libraries: data.libraries,
			items: [],
			tasks: [],
			settings: data.settings
		}
	);
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

	async function submitAction(
		action: string,
		payload: Record<string, string | boolean | undefined>
	) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(payload)) {
			if (typeof value !== 'undefined') formData.set(key, String(value));
		}
		const response = await fetch(`?/${action}`, {
			method: 'POST',
			body: formData
		});
		if (!response.ok) throw new Error(response.statusText);
	}

	async function refresh() {
		busy = true;
		try {
			const [settings, sources, libraries] = await Promise.all([
				api<PublicSettings>('/api/settings'),
				api<Source[]>('/api/sources'),
				api<Library[]>('/api/libraries')
			]);
			refreshedData = { settings, sources, libraries };
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
			await submitAction('saveTmdb', {
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

	async function testTmdbSettings() {
		busy = true;
		try {
			await post('/api/tmdb/test', { apiKey: tmdbApiKey || undefined });
			message = m.toast_test_succeeded();
		} catch (error) {
			message = String(error);
		} finally {
			busy = false;
		}
	}

	async function saveFileSettings() {
		busy = true;
		try {
			await submitAction('saveFileSettings', {
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
			await submitAction('createLibrary', libraryForm);
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

	async function testLibraryPath() {
		busy = true;
		try {
			await post('/api/webdav/path-test', {
				sourceId: libraryForm.sourceId,
				path: libraryForm.path
			});
			message = m.toast_test_succeeded();
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
			await submitAction('createSource', sourceForm);
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

<PageHeader title="媒体管理" description="集中管理元数据、命名、媒体源和 Library Path。" {message}>
	{#snippet actions()}
		<Button disabled={busy} onclick={refresh} variant="outline">刷新</Button>
	{/snippet}
</PageHeader>

<div class="flex flex-col gap-6">
	<SectionPanel title="元数据配置" description="配置外部元数据服务。">
		<MetadataSettingsForm
			bind:tmdbApiKey
			currentKey={workspace.settings.tmdbApiKey}
			{busy}
			onSave={saveTmdbSettings}
			onTest={testTmdbSettings}
			testLabel={m.action_test_tmdb()}
		/>
	</SectionPanel>

	<SectionPanel title="文件管理" description="控制整理后的命名和本地元数据文件输出。">
		<FileManagementSettingsForm
			bind:namingLanguage
			bind:metadataEnabled
			{busy}
			onSave={saveFileSettings}
		/>
	</SectionPanel>

	<SectionPanel title="Library Paths" description="每个路径是一个独立的媒体库管理入口。">
		{#snippet actions()}
			<Button onclick={() => (addLibraryOpen = true)}>添加 Library Path</Button>
		{/snippet}

		<LibraryPathsTable
			libraries={workspace.libraries}
			{busy}
			onAdd={() => (addLibraryOpen = true)}
			onToggleAutoOrganize={toggleAutoOrganize}
		/>
	</SectionPanel>

	<SectionPanel title="媒体源" description="管理 WebDAV 来源和认证信息。">
		{#snippet actions()}
			<Button onclick={() => (addSourceOpen = true)}>添加媒体源</Button>
		{/snippet}

		<SourcesTable sources={workspace.sources} onAdd={() => (addSourceOpen = true)} />
	</SectionPanel>
</div>

<LibraryPathDialog
	bind:open={addLibraryOpen}
	bind:form={libraryForm}
	sources={workspace.sources}
	{busy}
	testLabel={m.action_test_connection()}
	onSave={saveLibrary}
	onTest={testLibraryPath}
/>

<SourceDialog
	bind:open={addSourceOpen}
	bind:form={sourceForm}
	{busy}
	onSave={saveSource}
	onTest={testSource}
/>
