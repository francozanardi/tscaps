import { memo, useCallback, useMemo, useState } from 'react';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import { OutputFrame, type OutputFrameBackdrop, type OutputFrameFit, type OutputFrameFormat } from '@core/output-frame/domain/OutputFrame';
import { PictureChoice } from '@ui/_shared/components/controls/fields/PictureChoice';
import { SegmentedChoice } from '@ui/_shared/components/controls/fields/SegmentedChoice';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { useOutputFrame } from '@ui/_shared/contexts/modules/OutputFrameContext';
import { EditorTab } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { OutputFrameCropPicker } from '@ui/pages/editor/features/output-frame/OutputFrameCropPicker';
import { useShotPoster } from '@ui/pages/editor/features/shots/hooks/useShotPoster';
import { useVideoFrameSampler } from '@ui/pages/editor/features/shots/hooks/useVideoFrameSampler';
import { useActiveShotId } from '@ui/pages/editor/features/shots/hooks/useActiveShotId';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useOverlaySelectionController } from '@ui/pages/editor/contexts/OverlaySelectionContext';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import { useShotLayerMotionForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerMotionForm';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { CameraCropNotice } from '@ui/pages/editor/features/shots/camera/CameraCropNotice';

interface OutputFrameTabProps {
  outputFrame: OutputFrame;
  /** The video's own size, or null while it is not known. */
  videoLayout: VideoLayout | null;
}

const FORMAT_LABELS: Readonly<Record<OutputFrameFormat, string>> = {
  original: 'Original',
  '9:16': '9:16',
  '1:1': '1:1',
  '4:5': '4:5',
  '16:9': '16:9',
};
const FIT_OPTIONS = [
  { value: 'fill', label: 'Fill', tooltip: 'Fills the frame and crops what falls outside it' },
  { value: 'fit', label: 'Fit', tooltip: 'Shows the whole video, with a background around it' },
] as const;
const BACKDROP_OPTIONS = [
  { value: 'blur', label: 'Blurred' },
  { value: 'black', label: 'Black' },
] as const;
const PICTURE_SIDE = 28;
const NOTE_CLASS = 'text-xs text-fg-muted';

/**
 * The shape the video is exported in, and how the video sits in it: the
 * format, filled (cropped, at a position on the axis it is cropped on)
 * or fitted over a backdrop. Every change is one undo step; a drag of the
 * crop box is one too.
 */
export const OutputFrameTab = memo(function OutputFrameTab({ outputFrame, videoLayout }: OutputFrameTabProps) {
  const { actions } = useOutputFrame();
  const set = useCallback((frame: OutputFrame) => actions.set.execute(frame), [actions]);
  const videoShape = videoLayout !== null && videoLayout.width > 0 && videoLayout.height > 0
    ? videoLayout.width / videoLayout.height
    : null;

  const formats = OutputFrame.formats().map((format) => ({
    value: format,
    label: FORMAT_LABELS[format],
    picture: <FormatPicture shape={OutputFrame.aspectRatioOf(format) ?? videoShape ?? 16 / 9} dashed={format === 'original'} />,
  }));

  return (
    <EditorTab title="Aspect ratio">
      <div className="flex flex-col">
        <Section>
          <PictureChoice
            label="Aspect ratio"
            hideLabel
            value={outputFrame.format}
            options={formats}
            onChange={(format) => set(outputFrame.withFormat(format as OutputFrameFormat))}
          />
          <p className={NOTE_CLASS}>
            {outputFrame.isOriginal()
              ? 'The video is exported in its own shape.'
              : 'The video is exported in this shape. Captions and shot layers are laid out on it.'}
          </p>
        </Section>
        {!outputFrame.isOriginal() && (
          <Section title="Video">
            <SegmentedChoice
              label="Size"
              value={outputFrame.fit}
              options={FIT_OPTIONS}
              onChange={(fit) => set(outputFrame.withFit(fit as OutputFrameFit))}
            />
            {outputFrame.fit === 'fit' ? (
              <SegmentedChoice
                label="Background"
                value={outputFrame.backdrop}
                options={BACKDROP_OPTIONS}
                onChange={(backdrop) => set(outputFrame.withBackdrop(backdrop as OutputFrameBackdrop))}
              />
            ) : (
              <CropPosition outputFrame={outputFrame} videoLayout={videoLayout} onChange={set} />
            )}
          </Section>
        )}
      </div>
    </EditorTab>
  );
});

interface CropPositionProps {
  outputFrame: OutputFrame;
  videoLayout: VideoLayout | null;
  onChange: (frame: OutputFrame) => void;
}

/**
 * Where a filled video is cropped, on the one axis it is cropped on, as
 * a box on a frame of the video, the one at the playhead when the tab
 * was opened; nothing where it is not cropped.
 */
const CropPosition = memo(function CropPosition({ outputFrame, videoLayout, onChange }: CropPositionProps) {
  const store = useEditorStore();
  const { video } = useEditorState();
  // Taken once: the frame the user was looking at, which a moving playhead does not keep changing.
  const [posterSec] = useState(() => store.snapshot().video.currentTime);
  const sampler = useVideoFrameSampler();
  const poster = useShotPoster(sampler, video.preview?.file ?? video.file, posterSec);
  const axis = outputFrame.croppedAxis(videoLayout);
  const frameAspect = OutputFrame.aspectRatioOf(outputFrame.format);
  if (axis === null || videoLayout === null || frameAspect === null) return null;
  return (
    <div className="flex flex-col gap-2">
      <OutputFrameCropPicker
        poster={poster}
        videoAspect={videoLayout.width / videoLayout.height}
        frameAspect={frameAspect}
        axis={axis}
        position={outputFrame.position}
        onChange={(position) => onChange(outputFrame.withPosition(position))}
      />
      <p className={NOTE_CLASS}>Drag the box to choose which part of the video shows.</p>
      <OwnCameraNotice axis={axis} />
    </div>
  );
});

interface OwnCameraNoticeProps {
  /** The axis the frame crops the video on. */
  axis: 'x' | 'y';
}

/**
 * Says so when the shot at the playhead places its own camera on the
 * axis the frame crops, where the crop picked here does not move it:
 * with a way to give it back to the frame, unless its camera travels
 * along that axis (a pan), and a way to open its camera.
 */
const OwnCameraNotice = memo(function OwnCameraNotice({ axis }: OwnCameraNoticeProps) {
  const { actions, services, editTelemetry } = useShots();
  const state = useEditorState();
  const selection = useOverlaySelectionController();
  const partition = useMemo(() => services.materializer.materializeFrom(state), [services, state]);
  const playingShotId = useActiveShotId(partition);
  // The camera on screen is the playing shot's own, or an earlier shot's running through it.
  const shotId = playingShotId === null ? null : partition.videoShotOf(playingShotId)?.id ?? null;
  const form = useShotLayerMotionForm();
  const style = shotId === null ? undefined : partition.layerStyles.get(ShotVideoLayerId.of(shotId));
  const camera = form.cameraOf(style?.fields, style?.animations?.[ElementAnimationScope.CAMERA]);
  if (shotId === null || !camera.holdsOwnShare(axis)) return null;
  const travels = axis === 'x' && camera.pans;
  const number = partition.list().findIndex((shot) => shot.id === shotId) + 1;
  return (
    <CameraCropNotice
      message={travels
        ? `In shot ${number}, the camera pans across the whole video, so this position is not used.`
        : `In shot ${number}, the camera uses its own position, not this one.`}
      onFollow={travels ? undefined : () => {
        actions.setCamera.followFrame({ kind: 'shot', shotId }, axis);
        editTelemetry.ownCameraNoticeActed('follow-frame');
      }}
      onEditCamera={() => {
        selection.pickShot(shotId);
        editTelemetry.ownCameraNoticeActed('edit-camera');
      }}
    />
  );
});

interface FormatPictureProps {
  /** Width over height. */
  shape: number;
  /** Drawn dashed: the video's own shape, whatever it is. */
  dashed: boolean;
}

/** A frame of `shape`, as large as fits a square, in `currentColor`. */
function FormatPicture({ shape, dashed }: FormatPictureProps) {
  const width = shape >= 1 ? PICTURE_SIDE : PICTURE_SIDE * shape;
  const height = shape >= 1 ? PICTURE_SIDE / shape : PICTURE_SIDE;
  return (
    <svg width={PICTURE_SIDE} height={PICTURE_SIDE} viewBox={`0 0 ${PICTURE_SIDE} ${PICTURE_SIDE}`} aria-hidden="true">
      <rect
        x={(PICTURE_SIDE - width) / 2 + 0.75}
        y={(PICTURE_SIDE - height) / 2 + 0.75}
        width={width - 1.5}
        height={height - 1.5}
        rx={2}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray={dashed ? '3 2' : undefined}
      />
    </svg>
  );
}
