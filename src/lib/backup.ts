/** Vault backup export/restore is disabled (API returns 410; do not re-enable lightly). */

export async function createBackup(_configId: string): Promise<string> {
  throw new Error('Backup export is disabled');
}

export async function restoreBackup(_backupJobId: string): Promise<string> {
  throw new Error('Backup restore is disabled');
}
