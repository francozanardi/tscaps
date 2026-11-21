import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { SkillInstaller } from '@mcp/domain/SkillInstaller';

/** {@link SkillInstaller} that copies the folder, so the skill keeps working if this checkout moves. */
export class CopyingSkillInstaller implements SkillInstaller {
  install(skillFolder: string, skillsFolder: string): string {
    const destination = path.join(skillsFolder, path.basename(skillFolder));
    mkdirSync(skillsFolder, { recursive: true });
    // An earlier copy may hold guides this version removed.
    rmSync(destination, { recursive: true, force: true });
    cpSync(skillFolder, destination, { recursive: true });
    return destination;
  }
}
