import { createContext, useContext, type ReactNode } from 'react';

export interface PostExportPromptRenderProps {
  readonly onDismiss: () => void;
}

export type PostExportPromptRenderer = (props: PostExportPromptRenderProps) => ReactNode;

const PostExportPromptSlotContext = createContext<PostExportPromptRenderer | null>(null);

/** Provides the caller-supplied replacement for the built-in export success toast. `null` means fall back to the default. */
export function PostExportPromptSlotProvider({
  value,
  children,
}: {
  value: PostExportPromptRenderer | null;
  children: ReactNode;
}) {
  return <PostExportPromptSlotContext.Provider value={value}>{children}</PostExportPromptSlotContext.Provider>;
}

/** Reads the caller-supplied post-export prompt renderer; returns `null` when no override was passed. */
export function usePostExportPromptSlot(): PostExportPromptRenderer | null {
  return useContext(PostExportPromptSlotContext);
}
