export const queryKeys = {
	libraries: ['libraries'] as const,
	libraryItems: (libraryPathId: string) => ['library-items', libraryPathId] as const,
	itemDetail: (itemId: string | null) => ['library-item-detail', itemId] as const,
	planDraft: (draftId: string | null) => ['rename-plan-draft', draftId] as const,
	confirmedPlan: (itemId: string | null) => ['confirmed-rename-plan', itemId] as const,
	tmdbTvSeasons: (tmdbId: string | null) => ['tmdb-tv-seasons', tmdbId] as const,
	tmdbTvEpisodes: (tmdbId: string | null, season: number | null) =>
		['tmdb-tv-episodes', tmdbId, season] as const,
	webdavPathSuggestions: (sourceId: string | null, parentPath: string | null) =>
		['webdav-path-suggestions', sourceId, parentPath] as const,
	tasks: ['tasks'] as const,
	activeTasks: (targetKeys: string[]) => ['active-tasks', ...targetKeys] as const,
	taskDetail: (taskId: string | null) => ['task-detail', taskId] as const,
	settings: ['settings'] as const
};
