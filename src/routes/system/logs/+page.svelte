<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import SectionPanel from '$lib/components/SectionPanel.svelte';
	import { api, post, statusClass, type LogEntry } from '$lib/client/api';
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

<header class="mb-6 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-semibold text-slate-100">任务日志</h1>
		<p class="mt-1 text-sm text-slate-400">后台执行和集成日志。</p>
	</div>
	<div class="flex items-center gap-3">
		{#if message}<span class="text-sm text-slate-400">{message}</span>{/if}
		<Button disabled={busy} onclick={() => refresh()} variant="outline">刷新</Button>
		<Button disabled={busy} onclick={clearLogs} variant="outline">清空日志</Button>
	</div>
</header>

<SectionPanel title="日志">
	<div class="overflow-hidden rounded-md border border-slate-800">
		<table class="w-full text-left text-sm">
			<thead class="bg-slate-900 text-slate-400">
				<tr>
					<th class="px-4 py-3 font-medium">时间</th>
					<th class="px-4 py-3 font-medium">级别</th>
					<th class="px-4 py-3 font-medium">组件</th>
					<th class="px-4 py-3 font-medium">消息</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-800 bg-slate-950/60">
				{#each logs as entry (entry.id)}
					<tr>
						<td class="px-4 py-3 text-slate-300">{entry.time}</td>
						<td class="px-4 py-3">
							<span class={statusClass(entry.level === 'error' ? 'failed' : entry.level)}>{entry.level}</span>
						</td>
						<td class="px-4 py-3 font-medium text-slate-100">{entry.component}</td>
						<td class="px-4 py-3 text-slate-300">{entry.message}</td>
					</tr>
				{:else}
					<tr>
						<td class="px-4 py-6 text-slate-500" colspan="4">暂无日志。</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</SectionPanel>
