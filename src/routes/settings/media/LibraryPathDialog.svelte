<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import type { MediaType, Source } from '$lib/schemas/domain';

	type LibraryForm = {
		sourceId: string;
		path: string;
		mediaType: MediaType;
		autoOrganize: boolean;
	};

	type Props = {
		open: boolean;
		form: LibraryForm;
		sources: Source[];
		busy: boolean;
		testLabel: string;
		onSave: () => void | Promise<void>;
		onTest: () => void | Promise<void>;
	};

	let {
		open = $bindable(),
		form = $bindable(),
		sources,
		busy,
		testLabel,
		onSave,
		onTest
	}: Props = $props();

	const mediaTypeLabels: Record<LibraryForm['mediaType'], string> = {
		tv: '电视剧',
		movie: '电影'
	};

	const selectedSourceName = $derived(
		sources.find((source) => source.id === form.sourceId)?.name ?? '选择媒体源'
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>添加 Library Path</Dialog.Title>
			<Dialog.Description>选择 WebDAV 来源中的管理根路径，并指定媒体类型。</Dialog.Description>
		</Dialog.Header>

		<Field.Group>
			<Field.Field>
				<Field.Label>媒体源</Field.Label>
				<Select.Root type="single" bind:value={form.sourceId}>
					<Select.Trigger class="w-full">{selectedSourceName}</Select.Trigger>
					<Select.Content>
						<Select.Group>
							{#each sources as source (source.id)}
								<Select.Item value={source.id}>{source.name}</Select.Item>
							{/each}
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</Field.Field>

			<Field.Field>
				<Field.Label for="library-path">路径</Field.Label>
				<Input id="library-path" bind:value={form.path} />
			</Field.Field>

			<Field.Field>
				<Field.Label>媒体类型</Field.Label>
				<Select.Root type="single" bind:value={form.mediaType}>
					<Select.Trigger class="w-full">{mediaTypeLabels[form.mediaType]}</Select.Trigger>
					<Select.Content>
						<Select.Group>
							<Select.Item value="tv">电视剧</Select.Item>
							<Select.Item value="movie">电影</Select.Item>
						</Select.Group>
					</Select.Content>
				</Select.Root>
			</Field.Field>

			<Field.Field orientation="horizontal">
				<Checkbox id="library-auto-organize" bind:checked={form.autoOrganize} />
				<Field.Label for="library-auto-organize">自动整理高置信条目</Field.Label>
			</Field.Field>
		</Field.Group>

		<Dialog.Footer class="justify-between sm:justify-between">
			<Button variant="outline" disabled={busy || !form.sourceId || !form.path} onclick={onTest}>
				{testLabel}
			</Button>
			<div class="flex gap-2">
				<Button variant="outline" disabled={busy} onclick={() => (open = false)}>取消</Button>
				<Button disabled={busy} onclick={onSave}>保存</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
