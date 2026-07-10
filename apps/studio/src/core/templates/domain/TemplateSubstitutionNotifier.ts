export type TemplateSubstitutionListener = (missingTemplateId: string) => void;

/**
 * Broadcast channel for template-substitution events. A
 * `TemplateReferenceResolver` that applies a fallback policy publishes
 * here when it substitutes a missing id; interested consumers subscribe
 * during the scope where they care to observe substitutions and
 * unsubscribe when done.
 *
 * Listeners are invoked synchronously in registration order. Exceptions
 * thrown by a listener propagate; subscribers must not throw in normal
 * operation.
 */
export class TemplateSubstitutionNotifier {
  private readonly listeners = new Set<TemplateSubstitutionListener>();

  subscribe(listener: TemplateSubstitutionListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  notifySubstitution(missingTemplateId: string): void {
    for (const listener of this.listeners) listener(missingTemplateId);
  }
}
