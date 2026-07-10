import { memo } from 'react';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';

interface ExportButtonProps {
  disabled: boolean;
  label: string;
  onClick: () => void;
}

export const ExportButton = memo(function ExportButton({ disabled, label, onClick }: ExportButtonProps) {
  return (
    <button type="button" className={BTN_PRIMARY_SM} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
});
