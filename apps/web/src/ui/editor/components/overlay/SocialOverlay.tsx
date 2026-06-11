import '@ui/editor/components/overlay/SocialOverlay.css';
import { memo } from 'react';

/**
 * Visual-only mock of the platform chrome (action rail, username,
 * description) typically overlaid on a vertical short-form video.
 * Strictly a preview helper to gauge how subtitles read against the UI:
 * it never participates in export, sits at low opacity to signal it's a
 * guide, and is `pointer-events: none` so the subtitle overlay below
 * stays clickable.
 */
export const SocialOverlay = memo(function SocialOverlay() {
  return (
    <div className="social-overlay" aria-hidden="true">
      <div className="social-top">
        <span className="social-top-title">Reels</span>
        <CameraIcon />
      </div>
      <div className="social-rail">
        <RailItem label="48.2K"><RailButton><HeartIcon /></RailButton></RailItem>
        <RailItem label="612"><RailButton><CommentIcon /></RailButton></RailItem>
        <RailItem label="Share"><RailButton><PaperPlaneIcon /></RailButton></RailItem>
        <RailItem label="Save"><RailButton><BookmarkIcon /></RailButton></RailItem>
        <RailItem><RailButton><MoreDotsIcon /></RailButton></RailItem>
      </div>
      <div className="social-bottom">
        <div className="social-bottom-row social-bottom-row--user">
          <div className="social-avatar social-avatar--small"><PersonIcon /></div>
          <span className="social-handle">user.name</span>
          <span className="social-follow-pill">Follow</span>
        </div>
        <div className="social-bottom-row social-description">
          Post description goes here · #example
        </div>
        <div className="social-bottom-row social-bottom-row--music">
          <MusicNoteIcon /> <span className="social-music-text">Original audio · user.name</span>
        </div>
      </div>
    </div>
  );
});

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
);
const CommentIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a4 4 0 0 1-4 4H8l-5 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z"/></svg>
);
const PaperPlaneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
);
const BookmarkIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z"/></svg>
);
const MoreDotsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
);
const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>
);
const MusicNoteIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
);
const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 5h-3.2l-1.8-2H9L7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-8 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>
);

interface RailItemProps {
  label?: string;
  children: React.ReactNode;
}

function RailItem({ label, children }: RailItemProps) {
  return (
    <div className="social-rail-item">
      {children}
      {label && <span className="social-rail-label">{label}</span>}
    </div>
  );
}

function RailButton({ children }: { children: React.ReactNode }) {
  return <div className="social-rail-btn">{children}</div>;
}
