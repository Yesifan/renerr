<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Table from '$lib/components/ui/table';
	import type { Item, ItemDetail } from '$lib/schemas/domain';

	type Props = {
		item: Item;
		detail: ItemDetail | undefined;
		isFetching: boolean;
	};

	let {
		item,
		detail,
		isFetching
	}: Props = $props();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{item.title || item.topLevelPath}</Card.Title>
		<Card.Description>实时读取远端文件，扫描统计只作为摘要。</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		{#if detail}
			<div class="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
				<div class="rounded-xl bg-muted p-2">视频 {detail.summary.videoFileCount}</div>
				<div class="rounded-xl bg-muted p-2">符合 {detail.summary.compliantFileCount ?? 0}</div>
				<div class="rounded-xl bg-muted p-2">待整理 {detail.summary.nonCompliantFileCount ?? 0}</div>
			</div>
			<div class="max-h-[520px] overflow-auto rounded-xl border border-border">
				<Table.Root class="text-xs">
					<Table.Header>
						<Table.Row>
							<Table.Head>文件</Table.Head>
							<Table.Head>类型</Table.Head>
							<Table.Head>状态</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each detail.files as file (file.path)}
							<Table.Row>
								<Table.Cell class="text-foreground">{file.basename}</Table.Cell>
								<Table.Cell>{file.type}</Table.Cell>
								<Table.Cell>{file.compliance.state}</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		{:else if isFetching}
			<div class="flex flex-col gap-2">
				<Skeleton class="h-12 w-full" />
				<Skeleton class="h-32 w-full" />
			</div>
		{:else}
			<Empty.Root>
				<Empty.Header>
					<Empty.Title>无法读取详情</Empty.Title>
					<Empty.Description>刷新页面或重新扫描这个 item 后再试。</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{/if}
	</Card.Content>
</Card.Root>
