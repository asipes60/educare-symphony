/**
 * Drive uploader. Creates a per-task subfolder and uploads all files in
 * <workspace>/outputs/ to it. Returns the folder URL.
 */

import { readdirSync, statSync, createReadStream } from 'node:fs';
import { join, basename } from 'node:path';
import { google, drive_v3 } from 'googleapis';
import { taskLogger } from '../logging/structured.js';

let drive: drive_v3.Drive | null = null;

export function configureDrive(serviceAccountJson: string): void {
  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch (err) {
    throw new Error(`Invalid Drive service account JSON: ${(err as Error).message}`);
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  drive = google.drive({ version: 'v3', auth });
}

function ensureDrive(): drive_v3.Drive {
  if (!drive) {
    throw new Error('Drive not configured. Call configureDrive() first.');
  }
  return drive;
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\- ]/g, '_').substring(0, 80);
}

async function createSubfolder(
  parentFolderId: string,
  folderName: string,
): Promise<{ id: string; webViewLink: string }> {
  const d = ensureDrive();
  const res = await d.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  });
  if (!res.data.id || !res.data.webViewLink) {
    throw new Error('Drive folder create returned no id or webViewLink');
  }
  return { id: res.data.id, webViewLink: res.data.webViewLink };
}

async function uploadFile(
  parentFolderId: string,
  filePath: string,
): Promise<void> {
  const d = ensureDrive();
  await d.files.create({
    requestBody: {
      name: basename(filePath),
      parents: [parentFolderId],
    },
    media: {
      body: createReadStream(filePath),
    },
    fields: 'id',
    supportsAllDrives: true,
  });
}

export interface DriveUploadResult {
  folderId: string;
  folderUrl: string;
  filesUploaded: number;
}

/**
 * Upload all files from a workspace's outputs/ directory to a new Drive subfolder.
 * The subfolder is named <sanitized_task_name>_<task_id_short> per spec.
 */
export async function uploadWorkspaceOutputs(
  outputsDir: string,
  parentFolderId: string,
  taskId: string,
  taskName: string,
): Promise<DriveUploadResult> {
  const log = taskLogger(taskId);
  const folderName = `${sanitize(taskName)}_${taskId.substring(0, 6)}`;

  log.info({ folderName, parentFolderId }, 'Creating Drive subfolder');
  const folder = await createSubfolder(parentFolderId, folderName);

  let filesUploaded = 0;
  const entries = readdirSync(outputsDir);
  for (const entry of entries) {
    const fullPath = join(outputsDir, entry);
    const stat = statSync(fullPath);
    if (stat.isFile()) {
      await uploadFile(folder.id, fullPath);
      filesUploaded += 1;
    }
  }

  log.info({ folderUrl: folder.webViewLink, filesUploaded }, 'Drive upload complete');
  return {
    folderId: folder.id,
    folderUrl: folder.webViewLink,
    filesUploaded,
  };
}
