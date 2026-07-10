import type { IndexedDbClient } from '@core/_shared/infrastructure/IndexedDbClient';
import type { UserTemplate } from '@core/user-templates/domain/UserTemplate';
import type { UserTemplateRepository } from '@core/user-templates/domain/UserTemplateRepository';
import type { TemplateSerializer } from '@core/templates/services/TemplateSerializer';

const STORE = 'user-templates';

interface PersistedUserTemplateRecord {
  readonly id: string;
  readonly template: Record<string, unknown>;
  readonly parentTemplateId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Browser-side `UserTemplateRepository` backed by the shared IndexedDB
 * connection. The persisted record duplicates
 * `template.metadata.id` at the top level so the `keyPath: 'id'`
 * schema indexes without compound paths; `TemplateSerializer` handles
 * the template payload.
 */
export class IndexedDbUserTemplateRepository implements UserTemplateRepository {

  constructor(
    private readonly db: IndexedDbClient,
    private readonly templateSerializer: TemplateSerializer,
  ) {}

  async list(): Promise<readonly UserTemplate[]> {
    const records = await this.db.readAll<PersistedUserTemplateRecord>(STORE);
    return records.flatMap((record) => this.tryDeserialize(record));
  }

  save(userTemplate: UserTemplate): Promise<void> {
    return this.db.writeOne(STORE, this.serialize(userTemplate));
  }

  delete(id: string): Promise<void> {
    return this.db.deleteOne(STORE, id);
  }

  private serialize(userTemplate: UserTemplate): PersistedUserTemplateRecord {
    const serialized = this.templateSerializer.serialize(userTemplate.template);
    return {
      id: userTemplate.template.metadata.id,
      template: { ...serialized },
      parentTemplateId: userTemplate.parentTemplateId,
      createdAt: userTemplate.createdAt,
      updatedAt: userTemplate.updatedAt,
    };
  }

  private tryDeserialize(record: PersistedUserTemplateRecord): UserTemplate[] {
    try {
      return [{
        template: this.templateSerializer.deserialize(record.template),
        parentTemplateId: record.parentTemplateId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }];
    } catch (err) {
      console.warn(`[user-templates] dropping malformed record id="${record?.id ?? '?'}":`, err);
      return [];
    }
  }
}
