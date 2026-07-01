<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import * as Table from '$lib/components/ui/table';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SectionPanel from '$lib/components/SectionPanel.svelte';
	import { api } from '$lib/client/api';
	import { progressText, statusClass, statusText } from '$lib/client/formatters';
	import { resolve } from '$app/paths';
	import type { Task } from '$lib/schemas/domain';
	import { onMount } from 'svelte';

	let tasks = $state<Task[]>([]);
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
			tasks = await api<Task[]>('/api/tasks');
		} catch (error) {
			message = String(error);
		} finally {
			if (showBusy) busy = false;
		}
	}
</script>

<svelte:head>
	<title>任务队列 - Renarr</title>
</svelte:head>

<PageHeader title="任务队列" description="后台队列和执行状态。" {message}>
	{#snippet actions()}
		<Button disabled={busy} onclick={() => refresh()} variant="outline">刷新</Button>
	{/snippet}
</PageHeader>

<SectionPanel title="队列">
	{#if tasks.length}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>任务</Table.Head>
					<Table.Head>目标</Table.Head>
					<Table.Head>状态</Table.Head>
					<Table.Head>进度</Table.Head>
					<Table.Head>创建时间</Table.Head>
					<Table.Head>结束时间</Table.Head>
					<Table.Head>错误</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each tasks as task (task.id)}
					<Table.Row>
						<Table.Cell class="font-medium text-foreground">
							<a class="hover:text-primary" href={resolve(`/system/tasks/${task.id}`)}
								>{task.type}</a
							>
						</Table.Cell>
						<Table.Cell>{task.targetLabel || task.targetKey}</Table.Cell>
						<Table.Cell>
							<Badge variant="outline" class={statusClass(task.state)}
								>{statusText(task.state)}</Badge
							>
						</Table.Cell>
						<Table.Cell class="max-w-[280px] truncate">{progressText(task.progress)}</Table.Cell>
						<Table.Cell>{task.createdAt}</Table.Cell>
						<Table.Cell>{task.finishedAt || ''}</Table.Cell>
						<Table.Cell class="text-destructive">{task.error || ''}</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	{:else}
		<Empty.Root>
			<Empty.Header>
				<Empty.Title>暂无任务</Empty.Title>
				<Empty.Description>扫描或整理任务创建后会显示在这里。</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{/if}
</SectionPanel>
