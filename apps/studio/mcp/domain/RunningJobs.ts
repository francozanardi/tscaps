/** Whether work that outlasts a tool call is still going on in the editor page. */
export interface RunningJobs {
  /** The id of a job that has not ended yet; null when none is running. */
  runningJob(): string | null;
}
