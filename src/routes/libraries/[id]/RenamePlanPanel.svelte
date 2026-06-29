<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import * as Table from '$lib/components/ui/table';
	import type { RenamePlanDraft, RenamePlanDraftRow } from '$lib/schemas/domain';

	type Props = {
		draft: RenamePlanDraft;
		busy: boolean;
		submitLabel: string;
		onUpdateRow: (row: RenamePlanDraftRow) => void;
		onSubmit: () => void | Promise<void>;
	};

	let { draft, busy, submitLabel, onUpdateRow, onSubmit }: Props = $props();

	function updateSelected(row: RenamePlanDraftRow, checked: boolean | 'indeterminate') {
		onUpdateRow({ ...row, selected: checked === true });
	}

	function updateOverwrite(row: RenamePlanDraftRow, checked: boolean | 'indeterminate') {
		onUpdateRow({ ...row, conflictAction: checked === true ? 'overwrite' : null });
	}

	function updateNumber(row: RenamePlanDraftRow, field: 'season' | 'episode', value: string) {
		const parsed = Number(value);
		onUpdateRow({
			...row,
			[field]: Number.isFinite(parsed) && parsed > 0 ? parsed : null
		});
	}

	function onCellKeydown(event: KeyboardEvent, action: () => void) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			action();
		}
	}
</script>

<Card.Root class="min-w-0">
	<Card.Header>
		<Card.Title>整理计划</Card.Title>
		<Card.Description>目标路径由 identity、映射和命名模板计算，不能直接编辑。</Card.Description>
	</Card.Header>
		<Card.Content class="flex min-w-0 flex-col gap-3">
		<div class="max-h-[420px] overflow-auto rounded-xl border border-border">
			<Table.Root class="text-xs">
				<Table.Header>
					<Table.Row>
						<Table.Head>选中</Table.Head>
						<Table.Head>Source</Table.Head>
						<Table.Head>Mapping</Table.Head>
						<Table.Head>Target</Table.Head>
						<Table.Head>冲突</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each draft.rows as row (row.id)}
						<Table.Row>
								<Table.Cell
									class="cursor-pointer"
									role="button"
									tabindex={0}
									onclick={() => updateSelected(row, !row.selected)}
									onkeydown={(event) => onCellKeydown(event, () => updateSelected(row, !row.selected))}
								>
									<Checkbox checked={row.selected} class="pointer-events-none" />
							</Table.Cell>
							<Table.Cell class="max-w-[160px] truncate text-foreground">{row.sourceFilePath}</Table.Cell>
							<Table.Cell>
									{#if row.mediaKind === 'tv'}
										<div class="flex gap-2">
											<Input
												class="w-16"
												type="number"
												min="1"
												value={row.season ?? ''}
												oninput={(event) => updateNumber(row, 'season', event.currentTarget.value)}
											/>
											<Input
												class="w-16"
												type="number"
												min="1"
												value={row.episode ?? ''}
												oninput={(event) => updateNumber(row, 'episode', event.currentTarget.value)}
											/>
										</div>
								{:else}
									<span class="text-muted-foreground">movie</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="max-w-[180px] truncate">{row.targetFilePath || row.errorCode}</Table.Cell>
							<Table.Cell>
								{#if row.conflict}
										<div
											class="flex cursor-pointer items-center gap-2 text-amber-300"
											role="button"
											tabindex={0}
											onclick={() => updateOverwrite(row, row.conflictAction !== 'overwrite')}
											onkeydown={(event) =>
												onCellKeydown(event, () => updateOverwrite(row, row.conflictAction !== 'overwrite'))}
										>
											<Checkbox checked={row.conflictAction === 'overwrite'} class="pointer-events-none" />
											覆盖
										</div>
								{:else}
									<span class="text-muted-foreground">无</span>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
		<Button disabled={busy} onclick={onSubmit}>{submitLabel}</Button>
	</Card.Content>
</Card.Root>
