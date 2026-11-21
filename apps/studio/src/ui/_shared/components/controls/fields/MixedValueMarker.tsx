/**
 * Says that the elements a field edits together do not all hold the
 * value it shows: the field shows the first one's, and a change sets
 * every one of them. Drawn under a field's label, or beside a heading
 * whose choice has no label of its own.
 */
export function MixedValueMarker({ inline = false }: { inline?: boolean }) {
  return (
    <span
      className={`${inline ? 'inline-block' : 'block mt-0.5'} font-mono text-3xs uppercase tracking-[0.04em] text-fg-faint leading-none`}
    >
      Mixed
    </span>
  );
}
