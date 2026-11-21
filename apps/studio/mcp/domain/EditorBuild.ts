/** Where the built editor is and where it is mounted. */
export interface EditorBuild {
  /** The folder `vite build` wrote: `index.html` and `assets/`. */
  readonly distDir: string;
  /** The path the build was made for (Vite's `base`), with a slash at both ends: `/` or `/app/`. */
  readonly basePath: string;
}
