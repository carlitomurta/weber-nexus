import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const CONTROLLER_XML_DIAGNOSTICS_RELATIVE_DIR = path.join(
  'logs',
  'controller-xml',
);

export type ControllerXmlDiagnosticInput = {
  readonly ipAddress: string;
  readonly xml: string;
  readonly now?: Date;
};

export async function writeInvalidControllerXmlDiagnostic(
  input: ControllerXmlDiagnosticInput,
): Promise<string> {
  const diagnosticsDir =
    process.env.NEXUS_CONTROLLER_XML_DIAGNOSTICS_DIR ??
    path.join(process.cwd(), CONTROLLER_XML_DIAGNOSTICS_RELATIVE_DIR);
  const checksum = createHash('sha256')
    .update(input.xml, 'utf8')
    .digest('hex')
    .slice(0, 12);
  const filename = [
    'WLConfig-invalid',
    sanitizeFileNamePart(input.ipAddress),
    formatDiagnosticTimestamp(input.now ?? new Date()),
    checksum,
  ].join('-');
  const filePath = path.join(diagnosticsDir, `${filename}.xml`);

  await mkdir(diagnosticsDir, { recursive: true });
  await writeFile(filePath, `${input.xml.trimEnd()}\n`, { encoding: 'utf8' });

  return filePath;
}

function sanitizeFileNamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function formatDiagnosticTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}
