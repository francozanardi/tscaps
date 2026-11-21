/**
 * The assets recorded on this device that it still has to send where
 * their list lives. Their bytes here are the only copy, so nothing that
 * merely frees room may drop them.
 */
export interface UnsentMediaAssets {
  unsentIds(): Promise<ReadonlySet<string>>;
}
