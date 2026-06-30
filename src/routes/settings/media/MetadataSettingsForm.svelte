<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';

	type Props = {
		tmdbApiKey: string;
		currentKey: string;
		busy: boolean;
		onSave: () => void | Promise<void>;
		onTest: () => void | Promise<void>;
		testLabel: string;
	};

	let { tmdbApiKey = $bindable(), currentKey, busy, onSave, onTest, testLabel }: Props = $props();
</script>

<Field.Group>
	<Field.Field>
		<Field.Label for="tmdb-api-key">TMDB API Key</Field.Label>
		<Input id="tmdb-api-key" placeholder="输入新的 TMDB API Key" bind:value={tmdbApiKey} />
		<Field.Description>当前: {currentKey || '未设置'}</Field.Description>
	</Field.Field>
</Field.Group>

<div class="mt-5 flex justify-end gap-3">
	<Button disabled={busy || (!tmdbApiKey && !currentKey)} onclick={onTest} variant="outline">
		{testLabel}
	</Button>
	<Button disabled={busy || !tmdbApiKey} onclick={onSave}>保存元数据配置</Button>
</div>
