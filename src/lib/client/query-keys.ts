export const queryKeys = {
	workspace: ['workspace'] as const,
	libraryItems: (libraryPathId: string) => ['library-items', libraryPathId] as const,
	itemDetail: (itemId: string | null) => ['library-item-detail', itemId] as const,
	planDraft: (draftId: string | null) => ['rename-plan-draft', draftId] as const,
	tasks: ['tasks'] as const,
	logs: ['logs'] as const,
	settings: ['settings'] as const
};
