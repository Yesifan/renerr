<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import * as Table from '$lib/components/ui/table';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SectionPanel from '$lib/components/SectionPanel.svelte';
	import { api, post } from '$lib/client/api';
	import { statusClass } from '$lib/client/formatters';
	import type { LogEntry } from '$lib/schemas/domain';
	import { onMount } from 'svelte';

	let logs = $state<LogEntry[]>([]);
	let message = $state('');
	let busy = $state(false);

	onMount(() => {
		void refresh();
		const timer = setInterval(() => void refresh(false), 5000);
		return () => clearInterval(timer);
	});

	async function refresh(showBusy = true) {
		if (showBusy) busy = true;
		try {
			logs = await api<LogEntry[]>('/api/logs');
		} catch (error) {
			message = String(error);
		} finally {
			if (showBusy) busy = false;
		}
	}

	async function clearLogs() {
		busy = true;
		try {
			await post('/api/logs/clear');
			await refresh(false);
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>任务日志 - Renarr</title>
</svelte:head>

<PageHeader title="任务日志" description="后台执行和集成日志。" {message}>
	{#snippet actions()}
		<Button disabled={busy} onclick={() => refresh()} variant="outline">刷新</Button>
		<Button disabled={busy} onclick={clearLogs} variant="outline">清空日志</Button>
	{/snippet}
</PageHeader>

<SectionPanel title="日志">
	{#if logs.length}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>时间</Table.Head>
					<Table.Head>级别</Table.Head>
					<Table.Head>组件</Table.Head>
					<Table.Head>消息</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each logs as entry (entry.id)}
					<Table.Row>
						<Table.Cell>{entry.time}</Table.Cell>
						<Table.Cell>
							<Badge variant="outline" class={statusClass(entry.level === 'error' ? 'failed' : entry.level)}>{entry.level}</Badge>
						</Table.Cell>
						<Table.Cell class="font-medium text-foreground">{entry.component}</Table.Cell>
						<Table.Cell>{entry.message}</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	{:else}
		<Empty.Root>
			<Empty.Header>
				<Empty.Title>暂无日志</Empty.Title>
				<Empty.Description>后台执行和集成日志会显示在这里。</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{/if}
</SectionPanel>
