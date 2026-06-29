<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';

	type SourceForm = {
		name: string;
		url: string;
		username: string;
		credential: string;
	};

	type Props = {
		open: boolean;
		form: SourceForm;
		busy: boolean;
		onSave: () => void | Promise<void>;
		onTest: () => void | Promise<void>;
	};

	let { open = $bindable(), form = $bindable(), busy, onSave, onTest }: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>添加媒体源</Dialog.Title>
			<Dialog.Description>连接测试只验证认证和目录读取，不会写入远端文件。</Dialog.Description>
		</Dialog.Header>

		<Field.Group>
			<Field.Field>
				<Field.Label for="source-name">名称</Field.Label>
				<Input id="source-name" bind:value={form.name} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="source-url">URL</Field.Label>
				<Input id="source-url" bind:value={form.url} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="source-username">用户名</Field.Label>
				<Input id="source-username" bind:value={form.username} />
			</Field.Field>
			<Field.Field>
				<Field.Label for="source-credential">密码或 token</Field.Label>
				<Input id="source-credential" type="password" bind:value={form.credential} />
			</Field.Field>
		</Field.Group>

		<Dialog.Footer class="justify-between sm:justify-between">
			<Button variant="outline" disabled={busy} onclick={onTest}>测试连接</Button>
			<div class="flex gap-2">
				<Button variant="outline" disabled={busy} onclick={() => (open = false)}>取消</Button>
				<Button disabled={busy} onclick={onSave}>保存媒体源</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
