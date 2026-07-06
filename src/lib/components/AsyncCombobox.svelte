<script lang="ts" generics="Option">
	import { Combobox } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { asyncComboboxStatus } from '$lib/client/async-combobox';
	import { cn } from '$lib/utils';

	type Props = {
		id?: string;
		value: string;
		options: Option[];
		loading?: boolean;
		loaded?: boolean;
		error?: string;
		placeholder?: string;
		disabled?: boolean;
		emptyText?: string;
		loadingText?: string;
		errorText?: string;
		idleText?: string;
		class?: string;
		inputClass?: string;
		getKey: (option: Option) => string;
		getLabel: (option: Option) => string;
		onInput: (value: string) => void;
		onFocus?: () => void;
		onSelect: (option: Option) => void;
		option?: Snippet<[Option]>;
	};

	let {
		id,
		value,
		options,
		loading = false,
		loaded = false,
		error = '',
		placeholder,
		disabled = false,
		emptyText = '没有匹配项',
		loadingText = '正在加载...',
		errorText = '候选不可用，仍可手动输入。',
		idleText = '输入或聚焦以加载候选。',
		class: className,
		inputClass,
		getKey,
		getLabel,
		onInput,
		onFocus,
		onSelect,
		option
	}: Props = $props();

	let open = $state(false);
	let selectedValue = $state('');

	const status = $derived(
		asyncComboboxStatus(
			{
				loading,
				loaded,
				error,
				options
			},
			options
		)
	);

	function handleInput(event: Event) {
		const next = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : '';
		open = true;
		selectedValue = '';
		onInput(next);
	}

	function handleFocus() {
		open = true;
		onFocus?.();
	}

	function handleSelectedValueChange(next: string) {
		selectedValue = next;
		const selected = options.find((item) => getKey(item) === next);
		if (!selected) return;
		open = false;
		onSelect(selected);
	}
</script>

<div class={cn('relative min-w-0', className)}>
	<Combobox.Root
		type="single"
		bind:open
		value={selectedValue}
		onValueChange={handleSelectedValueChange}
		inputValue={value}
		{disabled}
	>
		<Combobox.Input
			{id}
			class={cn(
				'bg-input border-border focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-9 w-full min-w-0 rounded-4xl border px-3 py-1 text-base transition-colors file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-[3px] aria-invalid:ring-[3px] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
				inputClass
			)}
			{placeholder}
			autocomplete="off"
			aria-invalid={status === 'error' ? 'true' : undefined}
			oninput={handleInput}
			onfocus={handleFocus}
		/>

		<Combobox.Portal>
			<Combobox.Content
				sideOffset={4}
				class="bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/5 relative z-50 max-h-[min(18rem,50vh)] min-w-(--bits-combobox-anchor-width) overflow-x-hidden overflow-y-auto rounded-2xl p-1 shadow-2xl ring-1 duration-100"
			>
				<Combobox.Viewport class="w-full min-w-(--bits-combobox-anchor-width)">
					{#if status === 'loading'}
						<div class="px-3 py-2 text-xs text-muted-foreground">{loadingText}</div>
					{:else if status === 'error'}
						<div class="px-3 py-2 text-xs text-red-300">{errorText}</div>
					{:else if status === 'idle'}
						<div class="px-3 py-2 text-xs text-muted-foreground">{idleText}</div>
					{:else if status === 'empty'}
						<div class="px-3 py-2 text-xs text-muted-foreground">{emptyText}</div>
					{:else}
						{#each options as item (getKey(item))}
							{@const key = getKey(item)}
							<Combobox.Item
								value={key}
								label={getLabel(item)}
								class="focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex min-h-10 w-full cursor-default items-center rounded-xl px-3 py-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
							>
								{#if option}
									{@render option(item)}
								{:else}
									<span class="min-w-0 truncate">{getLabel(item)}</span>
								{/if}
							</Combobox.Item>
						{/each}
					{/if}
				</Combobox.Viewport>
			</Combobox.Content>
		</Combobox.Portal>
	</Combobox.Root>
</div>
