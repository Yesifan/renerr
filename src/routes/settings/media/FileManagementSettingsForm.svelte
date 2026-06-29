<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Field from '$lib/components/ui/field';
	import * as Select from '$lib/components/ui/select';

	type Props = {
		namingLanguage: string;
		metadataEnabled: boolean;
		busy: boolean;
		onSave: () => void | Promise<void>;
	};

	let {
		namingLanguage = $bindable(),
		metadataEnabled = $bindable(),
		busy,
		onSave
	}: Props = $props();

	const namingLanguageLabels: Record<string, string> = {
		'zh-CN': '中文优先',
		'en-US': '英文优先'
	};
</script>

<Field.Group>
	<Field.Field>
		<Field.Label>命名语言</Field.Label>
		<Select.Root type="single" bind:value={namingLanguage}>
			<Select.Trigger class="w-full">
				{namingLanguageLabels[namingLanguage] ?? namingLanguage}
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					<Select.Item value="zh-CN">中文优先</Select.Item>
					<Select.Item value="en-US">英文优先</Select.Item>
				</Select.Group>
			</Select.Content>
		</Select.Root>
	</Field.Field>

	<Field.Field orientation="horizontal">
		<Checkbox id="metadata-enabled" bind:checked={metadataEnabled} />
		<Field.Label for="metadata-enabled">整理成功后生成基础 NFO 和 poster</Field.Label>
	</Field.Field>
</Field.Group>

<div class="mt-5 flex justify-end">
	<Button disabled={busy} onclick={onSave}>保存文件管理设置</Button>
</div>
