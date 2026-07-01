export const queryKeys = {
	libraries: ['libraries'] as const,
	libraryItems: (libraryPathId: string) => ['library-items', libraryPathId] as const,
	itemDetail: (itemId: string | null) => ['library-item-detail', itemId] as const,
	planDraft: (draftId: string | null) => ['rename-plan-draft', draftId] as const,
	tasks: ['tasks'] as const,
	activeTasks: (targetKeys: string[]) => ['active-tasks', ...targetKeys] as const,
	taskDetail: (taskId: string | null) => ['task-detail', taskId] as const,
	logs: ['logs'] as const,
	settings: ['settings'] as const
};
