<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import * as Table from '$lib/components/ui/table';
	import type { Source } from '$lib/schemas/domain';

	type Props = {
		sources: Source[];
		onAdd: () => void;
	};

	let { sources, onAdd }: Props = $props();
</script>

{#if sources.length}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>名称</Table.Head>
				<Table.Head>URL</Table.Head>
				<Table.Head>用户名</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each sources as source (source.id)}
				<Table.Row>
					<Table.Cell class="font-medium text-foreground">{source.name}</Table.Cell>
					<Table.Cell>{source.url}</Table.Cell>
					<Table.Cell>{source.username}</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else}
	<Empty.Root>
		<Empty.Header>
			<Empty.Title>暂无媒体源</Empty.Title>
			<Empty.Description>添加 WebDAV 媒体源后可以配置 Library Path。</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			<Button onclick={onAdd}>添加媒体源</Button>
		</Empty.Content>
	</Empty.Root>
{/if}
