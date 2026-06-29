<script lang="ts">
	type Props = {
		title: string;
		description?: string;
		message?: string;
		actions?: import('svelte').Snippet;
	};

	let { title, description, message, actions }: Props = $props();
</script>

<header class="mb-6 flex flex-wrap items-start justify-between gap-3">
	<div>
		<h1 class="text-2xl font-semibold text-foreground">{title}</h1>
		{#if description}
			<p class="mt-1 text-sm text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if message || actions}
		<div class="flex flex-wrap items-center justify-end gap-3">
			{#if message}<span class="text-sm text-muted-foreground">{message}</span>{/if}
			{@render actions?.()}
		</div>
	{/if}
</header>
