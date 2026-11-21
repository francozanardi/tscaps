import { CssFragmentParser, CssMinifier } from '@tscaps/engine/advanced';
import { AspectRatioField } from '@core/elements/domain/fields/AspectRatioField';
import { CropXField } from '@core/elements/domain/fields/CropXField';
import { CropYField } from '@core/elements/domain/fields/CropYField';
import { PictureXField } from '@core/elements/domain/fields/PictureXField';
import { PictureYField } from '@core/elements/domain/fields/PictureYField';
import { PictureEndField } from '@core/elements/domain/fields/PictureEndField';
import { BoxWidthField } from '@core/elements/domain/fields/BoxWidthField';
import { CenterXField } from '@core/elements/domain/fields/CenterXField';
import { CenterYField } from '@core/elements/domain/fields/CenterYField';
import { CornerRadiusField } from '@core/elements/domain/fields/CornerRadiusField';
import { ElementFieldLibrary } from '@core/elements/domain/fields/ElementFieldLibrary';
import { LayerLayoutField } from '@core/elements/domain/fields/LayerLayoutField';
import { LayerPaddingField } from '@core/elements/domain/fields/LayerPaddingField';
import { ObjectFitField } from '@core/elements/domain/fields/ObjectFitField';
import { LayerBackdropField } from '@core/elements/domain/fields/LayerBackdropField';
import { SplitRatioField } from '@core/elements/domain/fields/SplitRatioField';
import { SplitSideField } from '@core/elements/domain/fields/SplitSideField';
import { SplitTransitionDurationField } from '@core/elements/domain/fields/SplitTransitionDurationField';
import { SplitTransitionField } from '@core/elements/domain/fields/SplitTransitionField';
import { StyledElementCatalog } from '@core/elements/domain/StyledElementCatalog';
import { DecorationElementType } from '@core/elements/domain/types/DecorationElementType';
import { LayerElementType } from '@core/elements/domain/types/LayerElementType';
import { LineElementType } from '@core/elements/domain/types/LineElementType';
import { SegmentElementType } from '@core/elements/domain/types/SegmentElementType';
import { WordElementType } from '@core/elements/domain/types/WordElementType';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { InsetSubjectField } from '@core/elements/domain/fields/InsetSubjectField';
import { InsetTransitionField } from '@core/elements/domain/fields/InsetTransitionField';
import { InsetTransitionDurationField } from '@core/elements/domain/fields/InsetTransitionDurationField';
import { ShotLayerLayoutFields } from '@core/shots/domain/ShotLayerLayoutFields';
import { ShotLayerPlacementSanitizer } from '@core/shots/domain/ShotLayerPlacementSanitizer';
import { ShotLayerLayoutWriter } from '@core/shots/services/ShotLayerLayoutWriter';

/**
 * A layer's layout written the way the app writes it, for tests that lay
 * layers out: every field a layer offers, the real CSS writer, and
 * nothing else of the app. A caption kind offers no field here.
 */
export class TestShotLayerLayouts {
  readonly controls = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));
  /** The layer kind, offering every field a layer offers. */
  readonly layerType: LayerElementType;
  readonly catalog: StyledElementCatalog;
  readonly writer: ShotLayerLayoutWriter;

  constructor() {
    const layerFields = new ElementFieldLibrary([
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
    const noFields = new ElementFieldLibrary([]);
    this.layerType = new LayerElementType(layerFields);
    this.catalog = new StyledElementCatalog({
      segment: new SegmentElementType(noFields),
      line: new LineElementType(noFields),
      word: new WordElementType(noFields),
      decoration: new DecorationElementType(noFields),
      layer: this.layerType,
    });
    this.writer = new ShotLayerLayoutWriter(this.catalog, this.controls, new ShotLayerLayoutFields(new ShotLayerPlacementSanitizer()));
  }
}
