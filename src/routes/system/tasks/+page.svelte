<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import * as Select from '$lib/components/ui/select';
	import * as Table from '$lib/components/ui/table';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SectionPanel from '$lib/components/SectionPanel.svelte';
	import { api } from '$lib/client/api';
	import { progressText, statusClass, statusText } from '$lib/client/formatters';
	import { messages as m, taskTypeLabel } from '$lib/i18n';
	import { resolve } from '$app/paths';
	import type { Task } from '$lib/schemas/domain';
	import { onMount } from 'svelte';

	const taskFilterOptions = [
		{ value: 'all', label: m.task_filter_all },
		{ value: 'execute_rename_plan', label: m.task_filter_execute_rename_plan },
		{ value: 'create_rename_plan_for_item', label: m.task_filter_create_rename_plan_for_item },
		{ value: 'scan_library_path', label: m.task_filter_scan_library_path },
		{ value: 'scan_library_item', label: m.task_filter_scan_library_item }
	];

	let tasks = $state<Task[]>([]);
	let message = $state('');
	let busy = $state(false);
	let taskFilter = $state('all');
	const selectedTaskFilterLabel = $derived(
		taskFilterOptions.find((option) => option.value === taskFilter)?.label() ?? m.task_filter_all()
	);

	onMount(() => {
		void refresh();
		const timer = setInterval(() => void refresh(false), 2500);
		return () => clearInterval(timer);
	});

	async function refresh(showBusy = true) {
		if (showBusy) busy = true;
		try {
			const query =
				taskFilter === 'all' ? 'limit=500' : `limit=500&type=${encodeURIComponent(taskFilter)}`;
			tasks = await api<Task[]>(`/api/tasks?${query}`);
		} catch (error) {
			message = String(error);
		} finally {
			if (showBusy) busy = false;
		}
	}

	function updateTaskFilter(next: string) {
		taskFilter = next;
		void refresh();
	}
</script>

<svelte:head>
	<title>{m.task_queue_title()} - Renarr</title>
</svelte:head>

<PageHeader title={m.task_queue_title()} description={m.task_queue_description()} {message}>
	{#snippet actions()}
		<Button disabled={busy} onclick={() => refresh()} variant="outline">{m.action_refresh()}</Button
		>
	{/snippet}
</PageHeader>

<SectionPanel title={m.task_queue_section()}>
	<div class="mb-4 flex flex-wrap items-center gap-3">
		<label class="grid gap-1 text-xs text-muted-foreground">
			<span>{m.task_filter_label()}</span>
			<Select.Root type="single" value={taskFilter} onValueChange={updateTaskFilter}>
				<Select.Trigger class="w-48">{selectedTaskFilterLabel}</Select.Trigger>
				<Select.Content>
					<Select.Group>
						{#each taskFilterOptions as option (option.value)}
							<Select.Item value={option.value}>{option.label()}</Select.Item>
						{/each}
					</Select.Group>
				</Select.Content>
			</Select.Root>
		</label>
	</div>
	{#if tasks.length}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>{m.task_column_task()}</Table.Head>
					<Table.Head>{m.task_column_target()}</Table.Head>
					<Table.Head>{m.task_column_state()}</Table.Head>
					<Table.Head>{m.task_column_progress()}</Table.Head>
					<Table.Head>{m.task_column_created_at()}</Table.Head>
					<Table.Head>{m.task_column_finished_at()}</Table.Head>
					<Table.Head>{m.task_column_error()}</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each tasks as task (task.id)}
					<Table.Row>
						<Table.Cell class="font-medium text-foreground">
							<a class="hover:text-primary" href={resolve(`/system/tasks/${task.id}`)}
								>{taskTypeLabel(task.type)}</a
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
				<Empty.Title>{m.task_empty_title()}</Empty.Title>
				<Empty.Description>{m.task_empty_description()}</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{/if}
</SectionPanel>
