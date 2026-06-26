<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	type Props = {
		open: boolean;
		title: string;
		description?: string;
		confirmLabel?: string;
		busy?: boolean;
		onclose: () => void;
		onconfirm: () => void | Promise<void>;
		children?: import('svelte').Snippet;
	};

	let {
		open,
		title,
		description,
		confirmLabel = '保存',
		busy = false,
		onclose,
		onconfirm,
		children
	}: Props = $props();
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<section class="w-full max-w-xl overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-2xl">
			<header class="border-b border-slate-800 px-6 py-4">
				<h2 class="text-lg font-semibold text-slate-100">{title}</h2>
				{#if description}
					<p class="mt-1 text-sm text-slate-400">{description}</p>
				{/if}
			</header>
			<div class="space-y-4 px-6 py-5">
				{@render children?.()}
			</div>
			<footer class="flex justify-end gap-2 border-t border-slate-800 bg-slate-900 px-6 py-4">
				<Button variant="outline" disabled={busy} onclick={onclose}>取消</Button>
				<Button disabled={busy} onclick={onconfirm}>{confirmLabel}</Button>
			</footer>
		</section>
	</div>
{/if}
