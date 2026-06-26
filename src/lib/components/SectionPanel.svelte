<script lang="ts">
	type Props = {
		title: string;
		description?: string;
		children?: import('svelte').Snippet;
		actions?: import('svelte').Snippet;
	};

	let { title, description, children, actions }: Props = $props();
</script>

<section class="rounded-lg border border-slate-800 bg-slate-950/70 shadow-sm">
	<header class="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
		<div>
			<h2 class="text-xl font-semibold text-slate-100">{title}</h2>
			{#if description}
				<p class="mt-1 text-sm text-slate-400">{description}</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex shrink-0 items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</header>
	<div class="px-6 py-5">
		{@render children?.()}
	</div>
</section>
