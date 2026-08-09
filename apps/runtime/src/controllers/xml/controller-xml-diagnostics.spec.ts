import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CONTROLLER_XML_DIAGNOSTICS_RELATIVE_DIR,
  writeInvalidControllerXmlDiagnostic,
} from './controller-xml-diagnostics';

describe('controller XML diagnostics', () => {
  const originalDiagnosticsDir =
    process.env.NEXUS_CONTROLLER_XML_DIAGNOSTICS_DIR;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'nexus-xml-diagnostics-'));
    process.env.NEXUS_CONTROLLER_XML_DIAGNOSTICS_DIR = path.join(
      tempDir,
      CONTROLLER_XML_DIAGNOSTICS_RELATIVE_DIR,
    );
  });

  afterEach(async () => {
    if (originalDiagnosticsDir === undefined) {
      delete process.env.NEXUS_CONTROLLER_XML_DIAGNOSTICS_DIR;
    } else {
      process.env.NEXUS_CONTROLLER_XML_DIAGNOSTICS_DIR = originalDiagnosticsDir;
    }

    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes invalid XML into logs/controller-xml diagnostics directory', async () => {
    const xml = '<configuration><invalid></configuration>';

    const filePath = await writeInvalidControllerXmlDiagnostic({
      ipAddress: '192.168.1.50',
      xml,
      now: new Date('2026-08-09T12:34:56.789Z'),
    });

    expect(filePath).toContain(
      path.join('logs', 'controller-xml', 'WLConfig-invalid-192.168.1.50'),
    );
    expect(path.basename(filePath)).not.toContain(':');
    await expect(readFile(filePath, 'utf8')).resolves.toBe(`${xml}\n`);
  });
});
