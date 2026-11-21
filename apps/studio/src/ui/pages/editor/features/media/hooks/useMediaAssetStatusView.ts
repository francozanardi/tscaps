import { MediaAssetStatusPresenter, type MediaAssetStatusView } from '@presentation/media/services/MediaAssetStatusPresenter';
import { useMediaAssetStatus } from '@ui/pages/editor/features/media/hooks/useMediaAssetStatus';

const PRESENTER = new MediaAssetStatusPresenter();

/** The state of one file as the chrome shows it, re-rendering on every change. */
export function useMediaAssetStatusView(assetId: string): MediaAssetStatusView {
  return PRESENTER.present(useMediaAssetStatus(assetId));
}
