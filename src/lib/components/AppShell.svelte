<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { api, libraryLabel, type Workspace } from '$lib/client/api';
	import { onMount } from 'svelte';

	let { children } = $props();
	let workspace = $state<Workspace>({
		sources: [],
		libraries: [],
		items: [],
		tasks: [],
		settings: { tmdbApiKey: '' }
	});

	let pathname = $derived(page.url.pathname);
	let settingsOpen = $derived(pathname.startsWith('/settings'));
	let systemOpen = $derived(pathname.startsWith('/system') || pathname === '/tasks');

	onMount(() => {
		void refresh();
		const timer = setInterval(() => void refresh(), 5000);
		return () => clearInterval(timer);
	});

	async function refresh() {
		try {
			workspace = await api<Workspace>('/api/workspace');
		} catch {
			// The pages surface API errors locally; the shell keeps stale navigation when possible.
		}
	}

	function navClass(href: string) {
		const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
		return [
			'block rounded-md px-3 py-2 transition',
			active ? 'bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-400/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'
		];
	}

	function sectionClass(active: boolean) {
		return [
			'flex items-center gap-2 rounded-md px-3 py-2 font-medium transition',
			active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
		];
	}

	function childClass(href: string) {
		const active = pathname === href || pathname.startsWith(`${href}/`);
		return [
			'block border-l py-2 pl-8 pr-3 transition',
			active
				? 'border-cyan-400 text-cyan-200'
				: 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-200'
		];
	}
</script>

<div class="min-h-screen bg-slate-950 text-slate-100">
	<header class="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-8 border-b border-white/10 bg-slate-950/95 px-6 backdrop-blur">
		<a class="text-xl font-semibold tracking-wide text-white" href={resolve('/')}>RENARR</a>
		<label class="flex w-[340px] items-center gap-3 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-400">
			<span class="text-base">⌕</span>
			<input
				class="w-full border-0 bg-transparent p-0 text-slate-100 placeholder:text-slate-500 focus:ring-0"
				placeholder="搜索"
			/>
		</label>
	</header>

	<div class="grid min-h-screen grid-cols-[260px_1fr] pt-14">
		<aside class="fixed bottom-0 left-0 top-14 w-[260px] overflow-y-auto border-r border-white/10 bg-slate-950 text-sm">
			<nav class="space-y-4 px-3 py-5">
				<section>
					<a class={navClass('/')} href={resolve('/')}>媒体库</a>
					<div class="pb-2">
						{#each workspace.libraries as library (library.id)}
							<a class={childClass(`/libraries/${library.id}`)} href={resolve(`/libraries/${library.id}`)}>
								{libraryLabel(library)}
							</a>
						{/each}
					</div>
				</section>

				<section>
					<a class={sectionClass(settingsOpen)} href={resolve('/settings/media')}>设置</a>
					<div class="pb-2">
						<a class={childClass('/settings/media')} href={resolve('/settings/media')}>媒体管理</a>
					</div>
				</section>

				<section>
					<a class={sectionClass(systemOpen)} href={resolve('/system/tasks')}>系统</a>
					<div class="pb-2">
						<a class={childClass('/system/tasks')} href={resolve('/system/tasks')}>任务队列</a>
						<a class={childClass('/system/logs')} href={resolve('/system/logs')}>任务日志</a>
					</div>
				</section>
			</nav>
		</aside>

		<div></div>

		<div class="min-w-0">
			<main class="min-w-0 bg-slate-900 p-8">
				{@render children?.()}
			</main>
		</div>
	</div>
</div>
