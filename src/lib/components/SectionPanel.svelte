<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	type Props = {
		title: string;
		description?: string;
		children?: import('svelte').Snippet;
		actions?: import('svelte').Snippet;
	};

	let { title, description, children, actions }: Props = $props();
</script>

<Card.Root class="min-w-0 max-w-full">
	<Card.Header class="border-b border-border">
		<Card.Title>{title}</Card.Title>
		{#if description}
			<Card.Description>{description}</Card.Description>
		{/if}
		{#if actions}
			<Card.Action class="flex items-center gap-2">
				{@render actions()}
			</Card.Action>
		{/if}
	</Card.Header>
	<Card.Content class="min-w-0">
		{@render children?.()}
	</Card.Content>
</Card.Root>
