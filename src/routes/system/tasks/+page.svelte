<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import SectionPanel from '$lib/components/SectionPanel.svelte';
	import { api, statusClass, statusText, type Task } from '$lib/client/api';
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

<header class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-semibold text-slate-100">任务队列</h1>
		<p class="mt-1 text-sm text-slate-400">后台队列和执行状态。</p>
	</div>
	<div class="flex items-center gap-3">
		{#if message}<span class="text-sm text-slate-400">{message}</span>{/if}
		<Button disabled={busy} onclick={() => refresh()} variant="outline">刷新</Button>
	</div>
</header>

<SectionPanel title="队列">
	<div class="overflow-hidden rounded-md border border-slate-800">
		<table class="w-full text-left text-sm">
			<thead class="bg-slate-900 text-slate-400">
				<tr>
					<th class="px-4 py-3 font-medium">任务</th>
					<th class="px-4 py-3 font-medium">状态</th>
					<th class="px-4 py-3 font-medium">创建时间</th>
					<th class="px-4 py-3 font-medium">错误</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-800 bg-slate-950/60">
				{#each tasks as task (task.id)}
					<tr>
						<td class="px-4 py-3 font-medium text-slate-100">{task.type}</td>
						<td class="px-4 py-3"><span class={statusClass(task.state)}>{statusText(task.state)}</span></td>
						<td class="px-4 py-3 text-slate-300">{task.createdAt}</td>
						<td class="px-4 py-3 text-red-300">{task.error || ''}</td>
					</tr>
				{:else}
					<tr>
						<td class="px-4 py-6 text-slate-500" colspan="4">暂无任务。</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</SectionPanel>
