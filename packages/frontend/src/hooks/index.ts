// Query Keys
export { queryKeys } from './queryKeys';
export type { QueryKeys } from './queryKeys';

// Custom Hooks
export { useDebounce, useDebounceCallback } from './useDebounce';
export { useSprintBoard } from './useSprintBoard';
export { useTaskMutations } from './useTaskMutations';
export { useDragAndDrop } from './useDragAndDrop';
export { useKeyboardDragDrop } from './useKeyboardDragDrop';

// Existing hooks (preserved for backward compatibility)
export { useApiError } from './useApiError';
export { useMutationErrorHandler } from './useMutationErrorHandler';
export { useModalFocus } from './useModalFocus';
export { useTimeout } from './useTimeout';
export { useFormDraft } from './useFormDraft';
export { useClickOutside } from './useClickOutside';
export { useEscapeKey } from './useEscapeKey';
export { useBeforeUnload, useFormUnloadProtection } from './useBeforeUnload';
export {
  useTeams,
  useTeam,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
} from './useTeamManagement';
export {
  useTeamGroups,
  useTeamGroupDetail,
  useTeamGroupSharedDoD,
  useCreateTeamGroup,
  useUpdateTeamGroup,
  useDeleteTeamGroup,
  useUpdateSharedDoD,
} from './useTeamGroups';
export type { GroupFormInput } from './useTeamGroups';
export { useTeamState } from './useTeamState';
export type { UseTeamStateReturn, TeamWithRole } from './useTeamState';
export { useSprintPlanningState } from './useSprintPlanningState';
export { useSprintsData } from './useSprintsData';
export { useVirtualScroll } from './useVirtualScroll';
export { useToast } from './useToast';
export { useRequireTeam, useTeamRole } from './useTeamContext';
export { useNotifications } from './useNotifications';
export { useModal } from './useModal';
export { useResponsive } from './useResponsive';
export { useScrollbarDetection } from './useScrollbarDetection';
export { useAccountDeletion } from './useAccountDeletion';
export type { UseAccountDeletionReturn } from './useAccountDeletion';
export { useUnsavedChanges } from './useUnsavedChanges';
export type { UseUnsavedChangesReturn } from './useUnsavedChanges';
export { useLogger, useGlobalLogger } from './useLogger';
export type { UseLoggerOptions, UseLoggerReturn } from './useLogger';

// Types
export type { SprintStats, UseSprintBoardOptions, UseSprintBoardReturn } from './useSprintBoard';

export type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskMutationError,
  UseTaskMutationsOptions,
  UseTaskMutationsReturn,
} from './useTaskMutations';

export type {
  DragAndDropState,
  ValidationResult,
  UseDragAndDropOptions,
  UseDragAndDropReturn,
} from './useDragAndDrop';

export type {
  DragDropItem,
  UseKeyboardDragDropProps,
  UseKeyboardDragDropReturn,
  GrabState,
  KeyboardHandlers,
  AriaAttributes,
} from './useKeyboardDragDrop';
