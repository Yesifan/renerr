<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { api } from '$lib/client/api';
	import { libraryLabel } from '$lib/client/formatters';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import * as Sidebar from '$lib/components/ui/sidebar';
	import { getLocale, locales, messages as m, setBrowserLocale, type Locale } from '$lib/i18n';
	import type { Library } from '$lib/schemas/domain';
	import { onMount } from 'svelte';

	type Props = {
		initialLibraries: Library[];
		children?: import('svelte').Snippet;
	};

	let { initialLibraries, children }: Props = $props();
	let refreshedLibraries = $state<Library[] | null>(null);
	let libraries = $derived(refreshedLibraries ?? initialLibraries);

	let pathname = $derived(page.url.pathname);
	let settingsOpen = $derived(pathname.startsWith('/settings'));
	let systemOpen = $derived(pathname.startsWith('/system') || pathname === '/tasks');
	let locale = $state<Locale>(getLocale());
	let currentLocaleLabel = $derived(locale === 'zh-CN' ? m.language_zh_cn() : locale);

	onMount(() => {
		void refresh();
		const timer = setInterval(() => void refresh(), 5000);
		return () => clearInterval(timer);
	});

	async function refresh() {
		try {
			refreshedLibraries = await api<Library[]>('/api/libraries');
		} catch {
			// The pages surface API errors locally; the shell keeps stale navigation when possible.
		}
	}

	function isActive(href: string) {
		return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
	}

	function updateLocale() {
		setBrowserLocale(locale);
	}

	$effect(updateLocale);
</script>

<Sidebar.Provider>
	<div class="grid min-h-svh w-full grid-rows-[auto_1fr] bg-background text-foreground">
		<header
			class="sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:h-14 md:flex-nowrap md:gap-8 md:px-6 md:py-0"
		>
			<a class="text-xl font-semibold tracking-wide text-foreground" href={resolve('/')}
				>{m.app_title()}</a
			>
			<label
				class="flex min-w-0 flex-1 items-center gap-3 text-sm text-muted-foreground md:max-w-[340px]"
			>
				<span class="text-base">⌕</span>
				<Input
					class="border-0 bg-transparent px-0 focus-visible:ring-0"
					placeholder={m.search_placeholder()}
				/>
			</label>
			<div class="flex items-center gap-2 text-sm text-muted-foreground md:ml-auto">
				<span>{m.language_label()}</span>
				<Select.Root type="single" bind:value={locale}>
					<Select.Trigger size="sm">{currentLocaleLabel}</Select.Trigger>
					<Select.Content>
						<Select.Group>
							{#each locales as option (option)}
								<Select.Item value={option}>{m.language_zh_cn()}</Select.Item>
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</div>
		</header>

		<div class="grid min-h-0 md:grid-cols-[260px_minmax(0,1fr)]">
			<Sidebar.Root
				collapsible="none"
				class="min-h-0 border-b border-border bg-sidebar text-sm text-sidebar-foreground md:w-[260px] md:border-b-0 md:border-r"
			>
				<Sidebar.Content class="px-3 py-4 md:py-5">
					<Sidebar.Group>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={isActive('/')}>
									{#snippet child({ props })}
										<a href={resolve('/')} {...props}>{m.nav_media_library()}</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
							<Sidebar.MenuSub>
								{#each libraries as library (library.id)}
									<Sidebar.MenuSubItem>
										<Sidebar.MenuSubButton isActive={isActive(`/libraries/${library.id}`)}>
											{#snippet child({ props })}
												<a href={resolve(`/libraries/${library.id}`)} {...props}
													>{libraryLabel(library)}</a
												>
											{/snippet}
										</Sidebar.MenuSubButton>
									</Sidebar.MenuSubItem>
								{/each}
							</Sidebar.MenuSub>
						</Sidebar.Menu>
					</Sidebar.Group>

					<Sidebar.Group>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={settingsOpen}>
									{#snippet child({ props })}
										<a href={resolve('/settings/media')} {...props}>{m.nav_settings()}</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
							<Sidebar.MenuSub>
								<Sidebar.MenuSubItem>
									<Sidebar.MenuSubButton isActive={isActive('/settings/media')}>
										{#snippet child({ props })}
											<a href={resolve('/settings/media')} {...props}>{m.nav_media_settings()}</a>
										{/snippet}
									</Sidebar.MenuSubButton>
								</Sidebar.MenuSubItem>
							</Sidebar.MenuSub>
						</Sidebar.Menu>
					</Sidebar.Group>

					<Sidebar.Group>
						<Sidebar.Menu>
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={systemOpen}>
									{#snippet child({ props })}
										<a href={resolve('/system/tasks')} {...props}>{m.nav_system()}</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
							<Sidebar.MenuSub>
								<Sidebar.MenuSubItem>
									<Sidebar.MenuSubButton isActive={isActive('/system/tasks')}>
										{#snippet child({ props })}
											<a href={resolve('/system/tasks')} {...props}>{m.nav_tasks()}</a>
										{/snippet}
									</Sidebar.MenuSubButton>
								</Sidebar.MenuSubItem>
								<Sidebar.MenuSubItem>
									<Sidebar.MenuSubButton isActive={isActive('/system/logs')}>
										{#snippet child({ props })}
											<a href={resolve('/system/logs')} {...props}>{m.nav_logs()}</a>
										{/snippet}
									</Sidebar.MenuSubButton>
								</Sidebar.MenuSubItem>
							</Sidebar.MenuSub>
						</Sidebar.Menu>
					</Sidebar.Group>
				</Sidebar.Content>
			</Sidebar.Root>

			<main class="min-w-0 bg-muted p-4 md:p-6 lg:p-8">
				{@render children?.()}
			</main>
		</div>
	</div>
</Sidebar.Provider>
