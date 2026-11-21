import { CssBlockSealer, CssMinifier } from '@tscaps/engine/advanced';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import type { ElementDescendantResolver } from '@core/elements/domain/ElementDescendantResolver';
import { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
import { FontFamilyField } from '@core/elements/domain/fields/FontFamilyField';
import { FontSizeField } from '@core/elements/domain/fields/FontSizeField';
import { FontWeightField } from '@core/elements/domain/fields/FontWeightField';
import { ItalicField } from '@core/elements/domain/fields/ItalicField';
import { RelativeSizeField } from '@core/elements/domain/fields/RelativeSizeField';
import { RotationField } from '@core/elements/domain/fields/RotationField';
import { StrikethroughField } from '@core/elements/domain/fields/StrikethroughField';
import { TextColorField } from '@core/elements/domain/fields/TextColorField';
import { UnderlineField } from '@core/elements/domain/fields/UnderlineField';
import { LayerLayoutField } from '@core/elements/domain/fields/LayerLayoutField';
import { ObjectFitField } from '@core/elements/domain/fields/ObjectFitField';
import { LayerBackdropField } from '@core/elements/domain/fields/LayerBackdropField';
import { CornerRadiusField } from '@core/elements/domain/fields/CornerRadiusField';
import { LayerPaddingField } from '@core/elements/domain/fields/LayerPaddingField';
import { InsetSubjectField } from '@core/elements/domain/fields/InsetSubjectField';
import { InsetTransitionField } from '@core/elements/domain/fields/InsetTransitionField';
import { InsetTransitionDurationField } from '@core/elements/domain/fields/InsetTransitionDurationField';
import { SplitSideField } from '@core/elements/domain/fields/SplitSideField';
import { SplitRatioField } from '@core/elements/domain/fields/SplitRatioField';
import { SplitTransitionDurationField } from '@core/elements/domain/fields/SplitTransitionDurationField';
import { SplitTransitionField } from '@core/elements/domain/fields/SplitTransitionField';
import { CenterXField } from '@core/elements/domain/fields/CenterXField';
import { CenterYField } from '@core/elements/domain/fields/CenterYField';
import { BoxWidthField } from '@core/elements/domain/fields/BoxWidthField';
import { AspectRatioField } from '@core/elements/domain/fields/AspectRatioField';
import { CropXField } from '@core/elements/domain/fields/CropXField';
import { CropYField } from '@core/elements/domain/fields/CropYField';
import { PictureXField } from '@core/elements/domain/fields/PictureXField';
import { PictureYField } from '@core/elements/domain/fields/PictureYField';
import { PictureEndField } from '@core/elements/domain/fields/PictureEndField';
import { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import { DecorationElementType } from '@core/elements/domain/types/DecorationElementType';
import { LayerElementType } from '@core/elements/domain/types/LayerElementType';
import { LineElementType } from '@core/elements/domain/types/LineElementType';
import { SegmentElementType } from '@core/elements/domain/types/SegmentElementType';
import { WordElementType } from '@core/elements/domain/types/WordElementType';
import { BalancedBlocksElementCssRule } from '@core/elements/services/css/BalancedBlocksElementCssRule';
import { CssControlledFieldFinder } from '@core/elements/services/css/CssControlledFieldFinder';
import type { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementCssValidator } from '@core/elements/services/css/ElementCssValidator';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { PlayheadAnchoredAnimationElementCssRule } from '@core/elements/services/css/PlayheadAnchoredAnimationElementCssRule';
import { UndrawnLayerDeclarationElementCssRule } from '@core/elements/services/css/UndrawnLayerDeclarationElementCssRule';
import { ResetCaptionElementAction } from '@core/elements/actions/ResetCaptionElementAction';
import { SetElementCssAction } from '@core/elements/actions/SetElementCssAction';
import type { AnimationFieldCatalog } from '@core/elements/domain/AnimationFieldCatalog';
import { ElementControlValueParser } from '@core/elements/services/css/ElementControlValueParser';
import { TemplateAnimationFieldResolver } from '@core/templates/services/animations/TemplateAnimationFieldResolver';
import { AnimationSupportResolver } from '@core/templates/services/animations/AnimationSupportResolver';
import { TemplateAnimationAnswerResolver } from '@core/templates/services/animations/TemplateAnimationAnswerResolver';
import { SetElementAnimationAction } from '@core/elements/actions/SetElementAnimationAction';
import { SetElementFieldAction } from '@core/elements/actions/SetElementFieldAction';
import { SetElementPlacementAction } from '@core/elements/actions/SetElementPlacementAction';
import { SetElementBlendAction } from '@core/elements/actions/SetElementBlendAction';

export interface ElementsDependencies {
  readonly store: EditorStore;
  readonly refresh: RefreshDocumentAction;
  readonly animationCatalog: ElementAnimationCatalog;
  readonly animationFieldCatalog: AnimationFieldCatalog;
  readonly controlCssWriter: ElementControlCssWriter;
  readonly animationCssWriter: ElementAnimationCssWriter;
  readonly elementDescendantResolver: ElementDescendantResolver;
}

export type ElementsModule = ReturnType<typeof bootElements>;

/**
 * Everything about styling one addressed element: the animations its
 * parts can be given, the fields of those animations, and the CSS
 * written by hand beside them.
 *
 * Separate from captions because an element is not a caption concept.
 * A word, a scene and an emoji are what can be addressed today; a GIF
 * or a widget joins them without any of this knowing. Nothing here
 * reads a `Document` — which elements a caption document holds is the
 * captions module's side of the boundary, and what it answers arrives
 * as an abstraction.
 */
export function bootElements(deps: ElementsDependencies) {
  const { store, refresh, animationCatalog, controlCssWriter, animationCssWriter, elementDescendantResolver } = deps;
  const timingVariableResolver = new ElementTimingVariableResolver();
  const templateAnimationFields = new TemplateAnimationFieldResolver(
    deps.animationFieldCatalog,
    new ElementControlValueParser(),
  );
  const templateAnimationAnswer = new TemplateAnimationAnswerResolver(animationCatalog, timingVariableResolver);
  const animationSupport = new AnimationSupportResolver();
  const cssControlledFieldFinder = new CssControlledFieldFinder(controlCssWriter);
  const fieldLibrary = new ElementFieldLibrary([
    new ItalicField(),
    new UnderlineField(),
    new StrikethroughField(),
    new FontFamilyField(),
    new FontSizeField(),
    new RelativeSizeField(),
    new FontWeightField(),
    new TextColorField(),
    new RotationField(),
    new LayerLayoutField(),
    new ObjectFitField(),
    new LayerBackdropField(),
    new CornerRadiusField(),
    new LayerPaddingField(),
    new SplitSideField(),
    new SplitRatioField(),
    new SplitTransitionField('entrance'),
    new SplitTransitionDurationField('entrance'),
    new SplitTransitionField('exit'),
    new SplitTransitionDurationField('exit'),
    new CenterXField(),
    new CenterYField(),
    new BoxWidthField(),
    new AspectRatioField(),
    new CropXField(),
    new CropYField(),
    new PictureXField(),
    new PictureYField(),
    new PictureEndField('x'),
    new PictureEndField('y'),
    new InsetSubjectField(),
    new InsetTransitionField('entrance'),
    new InsetTransitionDurationField('entrance'),
    new InsetTransitionField('exit'),
    new InsetTransitionDurationField('exit'),
  ]);
  const styledElementCatalog = new StyledElementCatalog({
    segment: new SegmentElementType(fieldLibrary),
    line: new LineElementType(fieldLibrary),
    word: new WordElementType(fieldLibrary),
    decoration: new DecorationElementType(fieldLibrary),
    layer: new LayerElementType(fieldLibrary),
  });
  return {
    services: {
      animationCatalog,
      templateAnimationFields,
      templateAnimationAnswer,
      animationSupport,
      styledElementCatalog,
      timingVariableResolver,
      cssControlledFieldFinder,
      animationCssWriter,
      cssValidator: new ElementCssValidator(new CssMinifier(), timingVariableResolver, [
        new BalancedBlocksElementCssRule(new CssBlockSealer()),
        new PlayheadAnchoredAnimationElementCssRule(),
        new UndrawnLayerDeclarationElementCssRule(),
      ]),
    },
    actions: {
      reset: new ResetCaptionElementAction(store, refresh),
      setCss: new SetElementCssAction(store, refresh),
      setAnimation: new SetElementAnimationAction(store, elementDescendantResolver, animationCssWriter, refresh),
      setField: new SetElementFieldAction(
        store,
        styledElementCatalog,
        elementDescendantResolver,
        controlCssWriter,
        cssControlledFieldFinder,
        refresh,
      ),
      setPlacement: new SetElementPlacementAction(store, refresh),
      setBlend: new SetElementBlendAction(store, elementDescendantResolver, refresh),
    },
  };
}
