import { useState } from 'react';
import { RotateCcw, Trash2, X } from 'lucide-react';
import type { ReviewNote } from '@core/review-notes/domain/ReviewNote';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { ReviewBubble } from '@ui/pages/editor/features/review-notes/components/ReviewBubble';
import { ReviewNoteField } from '@ui/pages/editor/features/review-notes/components/ReviewNoteField';
import { REVIEW_ICON_BUTTON } from '@ui/pages/editor/features/review-notes/review-notes-classes';

interface ReviewNoteCardProps {
  note: ReviewNote;
  /** The frame's box on screen. */
  frame: DOMRect;
  onEdit: (text: string) => void;
  onDelete: () => void;
  onSendAgain: () => void;
  onClose: () => void;
}

/**
 * A saved note's bubble. Any note can be deleted. A draft can be
 * rewritten; a sent note shows what it said, and can go back to the
 * drafts to be sent again with the next message.
 */
export function ReviewNoteCard({ note, frame, onEdit, onDelete, onSendAgain, onClose }: ReviewNoteCardProps) {
  const [text, setText] = useState(note.text);
  const at = note.place?.at ?? { x: 0.05, y: 0.05 };
  return (
    <ReviewBubble at={at} frame={frame} label={`Note ${note.number}`}>
      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold text-fg-primary tabular-nums">Note {note.number}</span>
        <span className="text-2xs text-fg-faint">{note.status === 'draft' ? 'Not sent yet' : 'Sent'}</span>
        <span className="flex-1" />
        <Tooltip text="Delete note">
          <button type="button" className={REVIEW_ICON_BUTTON} onClick={onDelete} aria-label={`Delete note ${note.number}`}>
            <Trash2 size={14} aria-hidden />
          </button>
        </Tooltip>
        <button type="button" className={REVIEW_ICON_BUTTON} onClick={onClose} aria-label="Close">
          <X size={14} aria-hidden />
        </button>
      </div>
      {note.status === 'draft' ? (
        <>
          <ReviewNoteField
            value={text}
            placeholder="What should change?"
            label={`Note ${note.number}`}
            onChange={setText}
            onSubmit={() => onEdit(text)}
            onCancel={onClose}
          />
          <div className="flex justify-end">
            <button type="button" className={BTN_PRIMARY_SM} onClick={() => onEdit(text)} disabled={text.trim() === ''}>Save</button>
          </div>
        </>
      ) : (
        <>
          <p className="m-0 text-sm leading-relaxed text-fg-secondary whitespace-pre-wrap">{note.text}</p>
          <div className="flex justify-end">
            <button type="button" className={BTN_SECONDARY_SM} onClick={onSendAgain}>
              <RotateCcw size={14} aria-hidden />
              Send again
            </button>
          </div>
        </>
      )}
    </ReviewBubble>
  );
}
