<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import { statusText } from '$lib/client/formatters';
	import type { Item } from '$lib/schemas/domain';
	import BadgeCheck from 'lucide-svelte/icons/badge-check';
	import CheckCircle2 from 'lucide-svelte/icons/check-circle-2';
	import CircleAlert from 'lucide-svelte/icons/circle-alert';
	import CircleHelp from 'lucide-svelte/icons/circle-help';
	import FileVideo from 'lucide-svelte/icons/file-video';
	import FolderArchive from 'lucide-svelte/icons/folder-archive';

	type Props = {
		item: Item;
		libraryPathId: string;
	};

	let { item, libraryPathId }: Props = $props();

	const statusTheme = $derived.by(() => {
		if (item.status === 'pending_review') {
			return {
				label: 'border-amber-500/30 bg-amber-500/20 text-amber-200 ring-amber-500/30',
				icon: 'text-amber-200'
			};
		}
		if (item.status === 'identified') {
			return {
				label: 'border-sky-500/30 bg-sky-500/20 text-sky-200 ring-sky-500/30',
				icon: 'text-sky-200'
			};
		}
		if (item.status === 'organized') {
			return {
				label: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-200 ring-emerald-500/30',
				icon: 'text-emerald-200'
			};
		}
		return {
			label: 'border-slate-500/30 bg-slate-500/20 text-slate-200 ring-slate-500/30',
			icon: 'text-slate-200'
		};
	});
	const iconClass = $derived(`size-4 ${statusTheme.icon}`);
</script>

<Card.Root class="group overflow-hidden p-0 py-0 transition-colors hover:border-primary/50">
	<a
		class="relative block aspect-[2/3] h-full overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		href={resolve('/libraries/[id]/[item_id]', { id: libraryPathId, item_id: item.id })}
		aria-label={`${item.title || item.topLevelPath}，${statusText(item.status, item.reviewReason)}`}
	>
		<div class="absolute inset-0 bg-muted">
			{#if item.posterUrl}
				<img
					class="h-full w-full object-cover"
					src={item.posterUrl}
					alt={item.title || item.topLevelPath}
				/>
			{:else}
				<div
					class="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--muted-foreground)/0.22),transparent_34%),linear-gradient(160deg,hsl(var(--muted)),hsl(var(--background)))] px-4 text-center text-sm text-muted-foreground"
				>
					<div
						class="flex size-12 items-center justify-center rounded-md border border-border bg-background/70"
					>
						{#if item.kind === 'folder'}
							<FolderArchive class="size-6 text-muted-foreground" aria-hidden="true" />
						{:else}
							<FileVideo class="size-6 text-muted-foreground" aria-hidden="true" />
						{/if}
					</div>
					<div class="line-clamp-5 break-all text-sm font-medium text-foreground">
						{item.topLevelPath}
					</div>
					<div class="text-xs text-muted-foreground">
						{item.kind === 'folder' ? '文件夹' : '视频文件'}
					</div>
				</div>
			{/if}
		</div>

		<div
			class={[
				'absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full border ring-1 backdrop-blur-sm',
				statusTheme.label
			]}
			title={statusText(item.status, item.reviewReason)}
		>
			{#if item.status === 'pending_review'}
				<CircleAlert class={iconClass} aria-hidden="true" />
			{:else if item.status === 'identified'}
				<BadgeCheck class={iconClass} aria-hidden="true" />
			{:else if item.status === 'organized'}
				<CheckCircle2 class={iconClass} aria-hidden="true" />
			{:else}
				<CircleHelp class={iconClass} aria-hidden="true" />
			{/if}
			<span class="sr-only">{statusText(item.status, item.reviewReason)}</span>
		</div>

		<Card.Content
			class="absolute inset-x-0 bottom-0 z-10 flex translate-y-2 flex-col gap-2 bg-gradient-to-t from-background/95 via-background/80 to-transparent p-3 pt-12 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none"
		>
			<div>
				<div class="line-clamp-2 text-sm font-medium text-foreground">
					{item.title || item.topLevelPath}
				</div>
				<div class="mt-1 text-xs text-muted-foreground">
					{item.year || '年份未知'} · {item.videoFileCount} 个视频
				</div>
			</div>
			<Badge variant="outline" class={statusTheme.label}>
				{statusText(item.status, item.reviewReason)}
			</Badge>
			{#if item.nonCompliantFileCount}
				<Badge variant="outline" class="border-amber-500/30 bg-amber-500/15 text-amber-300">
					待整理 {item.nonCompliantFileCount}
				</Badge>
			{/if}
		</Card.Content>
	</a>
</Card.Root>
