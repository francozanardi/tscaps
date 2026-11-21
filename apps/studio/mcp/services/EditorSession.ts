import type { BrowserLauncher } from '@mcp/domain/BrowserLauncher';
import type { EditorPage } from '@mcp/domain/EditorPage';
import type { PageChannel } from '@mcp/domain/PageChannel';
import type { EditorServer } from '@mcp/domain/EditorServer';

const CONNECT_TIMEOUT_MS = 120_000;
// How long a page that was connected is given to come back (a reload, a stream that dropped) before another is opened.
const RECONNECT_GRACE_MS = 8_000;

/**
 * The one editor page a session drives. The page is opened on first
 * need, not when the agent starts, so a session that never edits a
 * video opens nothing; a page the person closed is opened again on the
 * next call. Calls go to the page whichever way it was opened.
 */
export class EditorSession {
  private opening: Promise<void> | null = null;
  private opened = false;

  constructor(
    private readonly server: EditorServer,
    private readonly relay: PageChannel,
    private readonly launcher: BrowserLauncher,
    private readonly editorRoute: string,
  ) {}

  /** Where the page opens, in a few words. */
  get whereThePageOpens(): string {
    return this.launcher.description;
  }

  /**
   * The connected page, opening it first when needed: a page that was
   * open is first given a few seconds to reconnect, since a reload drops
   * its stream, and a second window would edit another, empty editor.
   * Rejects when no page connects in time.
   */
  async page(): Promise<EditorPage> {
    if (this.relay.isConnected()) return this.relay;
    if (this.opened && (await this.reconnected())) return this.relay;
    await this.open();
    return this.relay;
  }

  /** The page's URL, for a person who wants to open it themselves. */
  url(): string {
    return this.server.editorUrl(this.editorRoute);
  }

  async end(): Promise<void> {
    this.server.stop();
    await this.launcher.close();
  }

  private open(): Promise<void> {
    this.opening ??= this.launch().finally(() => {
      this.opening = null;
    });
    return this.opening;
  }

  private async launch(): Promise<void> {
    await this.launcher.open(this.url());
    await this.relay.connected(CONNECT_TIMEOUT_MS);
    this.opened = true;
  }

  /** Whether the page that was open connects again within the grace. */
  private async reconnected(): Promise<boolean> {
    try {
      await this.relay.connected(RECONNECT_GRACE_MS);
      return true;
    } catch {
      // It did not come back: the person closed it, and a new one is opened.
      return false;
    }
  }
}
