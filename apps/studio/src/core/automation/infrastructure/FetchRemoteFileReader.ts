import type { RemoteFileReader } from '@core/automation/domain/RemoteFileReader';

/** Reads the file with `fetch`; a status other than 2xx rejects. */
export class FetchRemoteFileReader implements RemoteFileReader {
  async read(url: string, fileName: string, mimeType: string): Promise<File> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Reading ${url} answered ${response.status}`);
    const blob = await response.blob();
    return new File([blob], fileName, { type: mimeType || blob.type });
  }
}
