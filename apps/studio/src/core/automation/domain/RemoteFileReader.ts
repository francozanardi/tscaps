/** Reads a file the program driving the page serves, by URL, as a `File` with the name and type given. */
export interface RemoteFileReader {
  read(url: string, fileName: string, mimeType: string): Promise<File>;
}
