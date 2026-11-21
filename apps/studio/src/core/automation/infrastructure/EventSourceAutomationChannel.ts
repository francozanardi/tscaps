import type { AutomationAnswer } from '@core/automation/domain/AutomationAnswer';
import type { AutomationCall } from '@core/automation/domain/AutomationCall';
import type { AutomationChannel } from '@core/automation/domain/AutomationChannel';

/**
 * The channel over plain HTTP to the program that served the page: calls
 * arrive as server-sent events, answers and file bytes go back as POSTs,
 * every request carrying the session's token. Same origin as the page,
 * so nothing here needs a cross-origin permission. The browser
 * reconnects the event stream by itself when it drops.
 */
export class EventSourceAutomationChannel implements AutomationChannel {
  constructor(private readonly token: string) {}

  listen(onCall: (call: AutomationCall) => void): void {
    const events = new EventSource(this.url('calls'));
    events.onmessage = (event: MessageEvent<string>) => onCall(JSON.parse(event.data) as AutomationCall);
  }

  async answer(answer: AutomationAnswer): Promise<void> {
    await this.post(this.url('answers'), JSON.stringify(answer), 'application/json');
  }

  async writeFile(fileId: string, position: number, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    await this.post(this.url('files', { file: fileId, position: String(position) }), bytes, 'application/octet-stream');
  }

  private url(path: string, extra: Record<string, string> = {}): string {
    const query = new URLSearchParams({ session: this.token, ...extra });
    return `/automation/${path}?${query.toString()}`;
  }

  private async post(url: string, body: BodyInit, contentType: string): Promise<void> {
    const response = await fetch(url, { method: 'POST', body, headers: { 'content-type': contentType } });
    if (!response.ok) throw new Error(`POST ${url.split('?')[0]} answered ${response.status}`);
  }
}
