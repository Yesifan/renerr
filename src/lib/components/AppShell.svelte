<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { api, libraryLabel, type Workspace } from '$lib/client/api';
	import { getLocale, locales, messages as m, setBrowserLocale, type Locale } from '$lib/i18n';
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
	let locale = $state<Locale>(getLocale());

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

	function updateLocale() {
		setBrowserLocale(locale);
	}
</script>

<div class="min-h-screen bg-slate-950 text-slate-100">
	<header class="z-20 flex min-h-14 flex-wrap items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur md:fixed md:inset-x-0 md:top-0 md:h-14 md:flex-nowrap md:gap-8 md:px-6 md:py-0">
		<a class="text-xl font-semibold tracking-wide text-white" href={resolve('/')}>{m.app_title()}</a>
		<label class="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-400 md:max-w-[340px]">
			<span class="text-base">⌕</span>
			<input
				class="w-full border-0 bg-transparent p-0 text-slate-100 placeholder:text-slate-500 focus:ring-0"
				placeholder={m.search_placeholder()}
			/>
		</label>
		<label class="flex items-center gap-2 text-sm text-slate-400 md:ml-auto">
			<span>{m.language_label()}</span>
			<select
				bind:value={locale}
				onchange={updateLocale}
				class="rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-slate-100"
			>
				{#each locales as option (option)}
					<option value={option}>{m.language_zh_cn()}</option>
				{/each}
			</select>
		</label>
	</header>

	<div class="md:grid md:min-h-screen md:grid-cols-[260px_1fr] md:pt-14">
		<aside class="border-b border-white/10 bg-slate-950 text-sm md:fixed md:bottom-0 md:left-0 md:top-14 md:w-[260px] md:overflow-y-auto md:border-b-0 md:border-r">
			<nav class="flex flex-col gap-4 px-3 py-4 md:py-5">
				<section>
					<a class={navClass('/')} href={resolve('/')}>{m.nav_media_library()}</a>
					<div class="pb-2">
						{#each workspace.libraries as library (library.id)}
							<a class={childClass(`/libraries/${library.id}`)} href={resolve(`/libraries/${library.id}`)}>
								{libraryLabel(library)}
							</a>
						{/each}
					</div>
				</section>

				<section>
					<a class={sectionClass(settingsOpen)} href={resolve('/settings/media')}>{m.nav_settings()}</a>
					<div class="pb-2">
						<a class={childClass('/settings/media')} href={resolve('/settings/media')}>{m.nav_media_settings()}</a>
					</div>
				</section>

				<section>
					<a class={sectionClass(systemOpen)} href={resolve('/system/tasks')}>{m.nav_system()}</a>
					<div class="pb-2">
						<a class={childClass('/system/tasks')} href={resolve('/system/tasks')}>{m.nav_tasks()}</a>
						<a class={childClass('/system/logs')} href={resolve('/system/logs')}>{m.nav_logs()}</a>
					</div>
				</section>
			</nav>
		</aside>

		<div class="hidden md:block"></div>

		<div class="min-w-0">
			<main class="min-w-0 bg-slate-900 p-4 md:p-8">
				{@render children?.()}
			</main>
		</div>
	</div>
</div>
