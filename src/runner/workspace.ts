/**
 * Per-task scratch workspace lifecycle. Each run gets an isolated directory
 * under .symphony/workspaces. Cleaned up on success per WORKFLOW.md config.
 */

import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { taskLogger } from '../logging/structured.js';

export interface Workspace {
  taskId: string;
  rootPath: string;
  outputsPath: string;
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60);
}

export function prepareWorkspace(rootDir: string, taskId: string, taskName: string): Workspace {
  const log = taskLogger(taskId);
  const slug = `${sanitize(taskName)}_${taskId.substring(0, 6)}`;
  const rootPath = resolve(rootDir, slug);
  const outputsPath = join(rootPath, 'outputs');

  mkdirSync(outputsPath, { recursive: true });
  log.debug({ workspacePath: rootPath }, 'Workspace prepared');

  return { taskId, rootPath, outputsPath };
}

export function cleanupWorkspace(workspace: Workspace, success: boolean, cleanupOnSuccess: boolean, cleanupOnFailure: boolean): void {
  const log = taskLogger(workspace.taskId);
  const shouldCleanup = success ? cleanupOnSuccess : cleanupOnFailure;

  if (!shouldCleanup) {
    log.debug({ workspacePath: workspace.rootPath }, 'Workspace retained for inspection');
    return;
  }

  if (existsSync(workspace.rootPath)) {
    rmSync(workspace.rootPath, { recursive: true, force: true });
    log.debug({ workspacePath: workspace.rootPath }, 'Workspace cleaned');
  }
}
