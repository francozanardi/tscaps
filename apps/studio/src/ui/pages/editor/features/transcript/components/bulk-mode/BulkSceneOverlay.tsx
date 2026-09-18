interface BulkSceneOverlayProps {
  selected: boolean;
  onClick: (extendRange: boolean) => void;
}

/** Turns a scene card into one large toggle target while bulk scene selection is active. */
export function BulkSceneOverlay({ selected, onClick }: BulkSceneOverlayProps) {
  return (
    <button
      type="button"
      className={
        'absolute inset-0 w-full cursor-pointer rounded-sm border transition-colors duration-quick ease-standard ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ' +
        (selected
          ? 'bg-accent/20 border-accent/70'
          : 'bg-transparent border-transparent hover:bg-accent/10 hover:border-accent/30')
      }
      aria-pressed={selected}
      aria-label={selected ? 'Remove scene from selection' : 'Add scene to selection'}
      onClick={(event) => onClick(event.shiftKey)}
    />
  );
}
