import { useEffect, useMemo, useState } from 'react';
import { OutdatedPageTelemetryReporter } from '@presentation/telemetry/services/OutdatedPageTelemetryReporter';
import { useTelemetry } from '@ui/_shared/contexts/modules/TelemetryContext';
import { useOutdatedPageTrigger } from '@ui/_shared/hooks/useOutdatedPageTrigger';
import { useUnsavedWork } from '@ui/_shared/hooks/useUnsavedWork';
import { OutdatedPageDialog } from '@ui/pages/editor/components/dialogs/OutdatedPageDialog';

/**
 * Shows the outdated-tab dialog from the moment this tab finds out that
 * a newer version of the app took over its data in this browser,
 * whichever page the reader is on, until the reader reloads or closes
 * it. Closing it is final for the page load: every save that fails
 * afterwards says the same thing in its own notice.
 */
export function OutdatedPageDialogHost() {
  const trigger = useOutdatedPageTrigger();
  const unsavedWork = useUnsavedWork();
  const telemetry = useTelemetry();
  const reporter = useMemo(() => new OutdatedPageTelemetryReporter(telemetry), [telemetry]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (trigger !== null) reporter.shown(trigger, unsavedWork);
  }, [trigger, unsavedWork, reporter]);

  return (
    <OutdatedPageDialog
      open={trigger !== null && !dismissed}
      unsavedWork={unsavedWork}
      onReload={() => window.location.reload()}
      onDismiss={() => setDismissed(true)}
    />
  );
}
