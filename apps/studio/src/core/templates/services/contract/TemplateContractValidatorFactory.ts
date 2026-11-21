import {
  CssCustomPropertyDefinitionScanner,
  CssFilterReferenceScanner,
  CssFragmentParser,
  CssKeyframesScanner,
  CssMinifier,
  CssSelectorClassScanner,
  CssVarReferenceScanner,
} from '@tscaps/engine/advanced';
import { TagConditionParser } from '@tscaps/engine';
import type { BuiltinSoundCatalog } from '@core/audio-mix/domain/BuiltinSoundCatalog';
import type { AssetReferenceIndex } from '@core/templates/domain/contract/AssetReferenceIndex';
import type { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import { StyleContract } from '@core/templates/domain/contract/StyleContract';
import { TemplateContractValidator } from '@core/templates/services/contract/TemplateContractValidator';
import { VariableReadsCssContractRule } from '@core/templates/services/contract/VariableReadsCssContractRule';
import { AnimationReferencesCssContractRule } from '@core/templates/services/contract/AnimationReferencesCssContractRule';
import { DeclaredAnimationsCssContractRule } from '@core/templates/services/contract/DeclaredAnimationsCssContractRule';
import { SelectorClassesCssContractRule } from '@core/templates/services/contract/SelectorClassesCssContractRule';
import { AssetReferencesCssContractRule } from '@core/templates/services/contract/AssetReferencesCssContractRule';
import { FilterReferencesCssContractRule } from '@core/templates/services/contract/FilterReferencesCssContractRule';
import { ImportantDeclarationsCssContractRule } from '@core/templates/services/contract/ImportantDeclarationsCssContractRule';
import { PublishedMotionCssContractRule } from '@core/templates/services/contract/PublishedMotionCssContractRule';
import { VariableReadsFiltersSvgContractRule } from '@core/templates/services/contract/VariableReadsFiltersSvgContractRule';
import { CommentSyntaxFiltersSvgContractRule } from '@core/templates/services/contract/CommentSyntaxFiltersSvgContractRule';
import { UnknownFieldsTemplateJsonContractRule } from '@core/templates/services/contract/UnknownFieldsTemplateJsonContractRule';
import { RedeclaredControlsTemplateJsonContractRule } from '@core/templates/services/contract/RedeclaredControlsTemplateJsonContractRule';
import { StyleControlsTemplateJsonContractRule } from '@core/templates/services/contract/StyleControlsTemplateJsonContractRule';
import { VariantsTemplateJsonContractRule } from '@core/templates/services/contract/VariantsTemplateJsonContractRule';
import { CategoryTemplateJsonContractRule } from '@core/templates/services/contract/CategoryTemplateJsonContractRule';
import { DescriptionTemplateJsonContractRule } from '@core/templates/services/contract/DescriptionTemplateJsonContractRule';
import { AddedOnTemplateJsonContractRule } from '@core/templates/services/contract/AddedOnTemplateJsonContractRule';
import { CalendarDateParser } from '@core/templates/domain/CalendarDateParser';
import { UnsupportedBrowsersTemplateJsonContractRule } from '@core/templates/services/contract/UnsupportedBrowsersTemplateJsonContractRule';
import { TileTemplateJsonContractRule } from '@core/templates/services/contract/TileTemplateJsonContractRule';
import { SoundsTemplateJsonContractRule } from '@core/templates/services/contract/SoundsTemplateJsonContractRule';
import { ModesTemplateJsonContractRule } from '@core/templates/services/contract/ModesTemplateJsonContractRule';
import { ModeMatcherRegistry } from '@core/caption-modes/services/ModeMatcherRegistry';

/**
 * Builds the validator with the standard rule set. This is the single
 * place that knows which rules exist, so every consumer — editor
 * wiring, the CI script — gets the same checks, and a new rule
 * registers here once.
 *
 * The asset index is the one dependency that differs per consumer
 * (live repository in the app, a directory listing in CI), so it
 * arrives as a parameter.
 */
export class TemplateContractValidatorFactory {

  constructor(
    private readonly styleControlCatalog: StyleControlCatalog,
    private readonly builtinSounds: BuiltinSoundCatalog,
  ) {}

  create(assetReferenceIndex: AssetReferenceIndex): TemplateContractValidator {
    const contract = new StyleContract();
    const varReferenceScanner = new CssVarReferenceScanner();
    return new TemplateContractValidator(
      new CssMinifier(),
      [
        new VariableReadsCssContractRule(contract, varReferenceScanner, new CssCustomPropertyDefinitionScanner()),
        new AnimationReferencesCssContractRule(new CssKeyframesScanner()),
        new DeclaredAnimationsCssContractRule(new CssKeyframesScanner()),
        new SelectorClassesCssContractRule(contract, new CssSelectorClassScanner()),
        new AssetReferencesCssContractRule(assetReferenceIndex),
        new FilterReferencesCssContractRule(new CssFilterReferenceScanner()),
        new ImportantDeclarationsCssContractRule(),
        new PublishedMotionCssContractRule(new CssFragmentParser(new CssMinifier()), new CssKeyframesScanner()),
      ],
      [
        new VariableReadsFiltersSvgContractRule(contract, varReferenceScanner),
        new CommentSyntaxFiltersSvgContractRule(),
      ],
      [
        new UnknownFieldsTemplateJsonContractRule(),
        new StyleControlsTemplateJsonContractRule(this.styleControlCatalog),
        new RedeclaredControlsTemplateJsonContractRule(),
        new VariantsTemplateJsonContractRule(),
        new CategoryTemplateJsonContractRule(),
        new DescriptionTemplateJsonContractRule(),
        new AddedOnTemplateJsonContractRule(new CalendarDateParser()),
        new UnsupportedBrowsersTemplateJsonContractRule(),
        new TileTemplateJsonContractRule(),
        new SoundsTemplateJsonContractRule(this.builtinSounds, new TagConditionParser()),
        new ModesTemplateJsonContractRule(new ModeMatcherRegistry(new TagConditionParser())),
      ],
    );
  }
}
