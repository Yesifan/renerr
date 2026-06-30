<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import { Switch } from '$lib/components/ui/switch';
	import * as Table from '$lib/components/ui/table';
	import { libraryLabel } from '$lib/client/formatters';
	import type { Library } from '$lib/schemas/domain';

	type Props = {
		libraries: Library[];
		busy: boolean;
		onAdd: () => void;
		onToggleAutoOrganize: (library: Library, autoOrganize: boolean) => void | Promise<void>;
	};

	let { libraries, busy, onAdd, onToggleAutoOrganize }: Props = $props();
</script>

{#if libraries.length}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>路径</Table.Head>
				<Table.Head>类型</Table.Head>
				<Table.Head>自动整理</Table.Head>
				<Table.Head>操作</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each libraries as library (library.id)}
				<Table.Row>
					<Table.Cell class="font-medium text-foreground">{libraryLabel(library)}</Table.Cell>
					<Table.Cell>{library.mediaType === 'tv' ? '电视剧' : '电影'}</Table.Cell>
					<Table.Cell>
						<label class="inline-flex items-center gap-2">
							<Switch
								size="sm"
								checked={library.autoOrganize}
								disabled={busy}
								onclick={() => onToggleAutoOrganize(library, !library.autoOrganize)}
							/>
							<span>{library.autoOrganize ? '开启' : '关闭'}</span>
						</label>
					</Table.Cell>
					<Table.Cell>
						<Button variant="link" href={resolve(`/libraries/${library.id}`)} class="h-auto px-0"
							>打开</Button
						>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{:else}
	<Empty.Root>
		<Empty.Header>
			<Empty.Title>暂无 Library Path</Empty.Title>
			<Empty.Description>添加一个 WebDAV Library Path 后可以开始扫描媒体库。</Empty.Description>
		</Empty.Header>
		<Empty.Content>
			<Button onclick={onAdd}>添加 Library Path</Button>
		</Empty.Content>
	</Empty.Root>
{/if}
