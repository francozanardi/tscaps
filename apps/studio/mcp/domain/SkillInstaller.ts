/** Puts a skill folder where an agent loads skills from. */
export interface SkillInstaller {
  /** Copies `skillFolder` into `skillsFolder`, replacing an earlier copy; returns the installed folder's path. */
  install(skillFolder: string, skillsFolder: string): string;
}
