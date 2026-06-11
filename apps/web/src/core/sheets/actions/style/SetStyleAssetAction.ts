import type { ControlField } from '@core/templates/domain/ControlField';
import type { UpdateStyleControlAction } from '@core/sheets/actions/style/UpdateStyleControlAction';

/**
 * Points an image-typed style control at a specific asset id, or
 * resets it to the template's default. Pure routing onto
 * `UpdateStyleControlAction` — asset persistence and uploads are
 * orchestrated elsewhere, so this action knows nothing about them.
 */
export class SetStyleAssetAction {
  constructor(private readonly updateStyleControl: UpdateStyleControlAction) {}

  execute(field: ControlField, assetId: string | null): void {
    const value = assetId ?? String(field.default);
    this.updateStyleControl.execute(field, value);
  }
}
