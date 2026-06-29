<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import * as Table from '$lib/components/ui/table';
	import type { Item, ItemDetail } from '$lib/schemas/domain';

	type Props = {
		selectedItem: Item | null;
		detail: ItemDetail | undefined;
		isFetching: boolean;
		scanLabel: string;
		planLabel: string;
		canScanItem: (item: Item) => boolean;
		canCreatePlan: (item: Item) => boolean;
		onScan: (item: Item) => void;
		onCreatePlan: (item: Item) => void;
	};

	let {
		selectedItem,
		detail,
		isFetching,
		scanLabel,
		planLabel,
		canScanItem,
		canCreatePlan,
		onScan,
		onCreatePlan
	}: Props = $props();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{selectedItem ? selectedItem.title || selectedItem.topLevelPath : 'Item Detail'}</Card.Title>
		<Card.Description>实时读取远端文件，扫描统计只作为摘要。</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-4">
		{#if selectedItem}
			<div class="flex flex-wrap gap-2">
				{#if canScanItem(selectedItem)}
					<Button size="sm" variant="outline" onclick={() => onScan(selectedItem)}>{scanLabel}</Button>
				{/if}
				{#if canCreatePlan(selectedItem)}
					<Button size="sm" onclick={() => onCreatePlan(selectedItem)}>{planLabel}</Button>
				{/if}
			</div>
			{#if detail}
				<div class="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
					<div class="rounded-xl bg-muted p-2">视频 {detail.summary.videoFileCount}</div>
					<div class="rounded-xl bg-muted p-2">符合 {detail.summary.compliantFileCount ?? 0}</div>
					<div class="rounded-xl bg-muted p-2">待整理 {detail.summary.nonCompliantFileCount ?? 0}</div>
				</div>
				<div class="max-h-[360px] overflow-auto rounded-xl border border-border">
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
			{/if}
		{:else}
			<Empty.Root>
				<Empty.Header>
					<Empty.Title>选择一个海报</Empty.Title>
					<Empty.Description>选择条目后会实时读取 WebDAV 文件。</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{/if}
	</Card.Content>
</Card.Root>
