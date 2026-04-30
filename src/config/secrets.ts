/**
 * Loads secrets from GCP Secret Manager in production, or from .env locally.
 * Determined by SYMPHONY_ENV. When set to "local", reads directly from process.env.
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from '../logging/structured.js';

let client: SecretManagerServiceClient | null = null;

function getClient(): SecretManagerServiceClient {
  if (!client) {
    client = new SecretManagerServiceClient();
  }
  return client;
}

function getProjectId(): string {
  const id = process.env.GCP_PROJECT_ID;
  if (!id) {
    throw new Error('GCP_PROJECT_ID environment variable not set');
  }
  return id;
}

const isLocal = (): boolean => process.env.SYMPHONY_ENV === 'local';

const cache = new Map<string, string>();

/**
 * Fetch a secret value. In local mode, reads from process.env. In production,
 * pulls the latest version from GCP Secret Manager.
 */
export async function getSecret(name: string): Promise<string> {
  if (cache.has(name)) {
    return cache.get(name)!;
  }

  if (isLocal()) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Secret ${name} not found in local environment`);
    }
    cache.set(name, value);
    return value;
  }

  const projectId = getProjectId();
  const secretPath = `projects/${projectId}/secrets/${name}/versions/latest`;

  logger.debug({ secret: name }, 'Fetching secret from Secret Manager');

  const [version] = await getClient().accessSecretVersion({ name: secretPath });
  const payload = version.payload?.data?.toString();

  if (!payload) {
    throw new Error(`Secret ${name} has no payload`);
  }

  cache.set(name, payload);
  return payload;
}

/**
 * Resolve a value that may contain a $VAR_NAME indirection. If the input string
 * starts with "$", treats the remainder as a secret name and fetches it. Otherwise
 * returns the input unchanged.
 */
export async function resolveSecretRef(value: string): Promise<string> {
  if (value.startsWith('$')) {
    return await getSecret(value.substring(1));
  }
  return value;
}

export function clearSecretCache(): void {
  cache.clear();
}
