/** What a command that ran to its end printed, and whether it succeeded. */
export interface CommandOutcome {
  readonly succeeded: boolean;
  readonly output: string;
}

/** Runs commands of this machine's command line, waiting for each to end. */
export interface CommandRunner {
  /** Whether `command` is found on the PATH. */
  isOnPath(command: string): boolean;
  /** Runs `command` and keeps what it prints, for a step whose output is not the person's to read. */
  capture(command: string, args: ReadonlyArray<string>, cwd?: string): CommandOutcome;
  /** Runs `command` with its output shown to the person as it prints; true when it succeeded. */
  show(command: string, args: ReadonlyArray<string>, cwd?: string): boolean;
}
