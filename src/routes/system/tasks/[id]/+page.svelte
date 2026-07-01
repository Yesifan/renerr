<script lang="ts">
	import { resolve } from '$app/paths';
	import { api } from '$lib/client/api';
	import { progressText, statusClass, statusText } from '$lib/client/formatters';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import * as Table from '$lib/components/ui/table';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SectionPanel from '$lib/components/SectionPanel.svelte';
	import type { TaskDetail } from '$lib/schemas/domain';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
	let detail = $state<TaskDetail | null>(null);
	let message = $state('');
	let busy = $state(false);

	onMount(() => {
		void refresh();
		const timer = setInterval(() => void refresh(false), 2500);
		return () => clearInterval(timer);
	});

	async function refresh(showBusy = true) {
		if (showBusy) busy = true;
		try {
			detail = await api<TaskDetail>(`/api/tasks/${params.id}`);
		} catch (error) {
			message = String(error);
		} finally {
			if (showBusy) busy = false;
		}
	}

	function json(value: unknown) {
		return JSON.stringify(value ?? {}, null, 2);
	}
</script>

<svelte:head>
	<title>任务详情 - Renarr</title>
</svelte:head>

<PageHeader title="任务详情" description={detail?.task.type ?? params.id} {message}>
	{#snippet actions()}
		<Button href={resolve('/system/tasks')} variant="outline">返回任务</Button>
		<Button disabled={busy} onclick={() => refresh()} variant="outline">刷新</Button>
	{/snippet}
</PageHeader>

{#if detail}
	<div class="flex flex-col gap-4">
		<SectionPanel title="状态">
			<div class="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
				<div>
					<div class="text-muted-foreground">状态</div>
					<Badge variant="outline" class={statusClass(detail.task.state)}
						>{statusText(detail.task.state)}</Badge
					>
				</div>
				<div>
					<div class="text-muted-foreground">目标</div>
					<div class="truncate text-foreground">{detail.task.targetLabel || detail.task.targetKey}</div>
				</div>
				<div>
					<div class="text-muted-foreground">进度</div>
					<div class="truncate text-foreground">{progressText(detail.task.progress) || '-'}</div>
				</div>
				<div>
					<div class="text-muted-foreground">完成时间</div>
					<div class="truncate text-foreground">{detail.task.finishedAt || '-'}</div>
				</div>
			</div>
			{#if detail.task.resultSummary}
				<pre class="mt-4 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">{json(
						detail.task.resultSummary
					)}</pre>
			{/if}
			{#if detail.detailsCleaned}
				<div class="mt-3 text-sm text-muted-foreground">详细日志或记录已按保留策略清理。</div>
			{/if}
		</SectionPanel>

		<SectionPanel title="任务日志">
			{#if detail.logs.length}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>时间</Table.Head>
							<Table.Head>级别</Table.Head>
							<Table.Head>组件</Table.Head>
							<Table.Head>消息</Table.Head>
							<Table.Head>摘要</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each detail.logs as entry (entry.id)}
							<Table.Row>
								<Table.Cell>{entry.time}</Table.Cell>
								<Table.Cell>
									<Badge
										variant="outline"
										class={statusClass(entry.level === 'error' ? 'failed' : entry.level)}
										>{entry.level}</Badge
									>
								</Table.Cell>
								<Table.Cell class="font-medium text-foreground">{entry.component}</Table.Cell>
								<Table.Cell>{entry.message}</Table.Cell>
								<Table.Cell class="max-w-[420px] truncate">{entry.summary || json(entry.context)}</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{:else}
				<Empty.Root>
					<Empty.Header>
						<Empty.Title>暂无任务日志</Empty.Title>
						<Empty.Description>任务运行中的业务事件会显示在这里。</Empty.Description>
					</Empty.Header>
				</Empty.Root>
			{/if}
		</SectionPanel>

		{#if detail.executionRecords.length}
			<SectionPanel title="执行记录">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>时间</Table.Head>
							<Table.Head>状态</Table.Head>
							<Table.Head>源路径</Table.Head>
							<Table.Head>目标路径</Table.Head>
							<Table.Head>错误</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each detail.executionRecords as record (record.id)}
							<Table.Row>
								<Table.Cell>{record.createdAt}</Table.Cell>
								<Table.Cell>
									<Badge variant="outline" class={statusClass(record.status)}
										>{record.status}</Badge
									>
								</Table.Cell>
								<Table.Cell class="max-w-[320px] truncate">{record.sourcePath}</Table.Cell>
								<Table.Cell class="max-w-[320px] truncate">{record.targetPath}</Table.Cell>
								<Table.Cell class="text-destructive">{record.error || ''}</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</SectionPanel>
		{/if}
	</div>
{/if}
