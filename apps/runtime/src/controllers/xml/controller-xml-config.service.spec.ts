const mockUploadWlConfigXml = jest.fn();
const mockCreateWlConfigUploadPlan = jest.fn();
const mockReadControllerLocalRegister = jest.fn();
jest.mock('./controller-file-transfer', () => ({
  createWlConfigUploadPlan: mockCreateWlConfigUploadPlan,
  downloadWlConfigXml: jest.fn(),
  readControllerLocalRegister: mockReadControllerLocalRegister,
  uploadWlConfigXml: mockUploadWlConfigXml,
}));

const mockLoggerDebug = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
jest.mock('@weber-nexus/logger', () => ({
  Logger: class {
    debug = mockLoggerDebug;
    error = mockLoggerError;
    info = mockLoggerInfo;
    warn = mockLoggerWarn;
  },
}));

jest.mock('@weber-nexus/repository', () => ({
  ControllersRepository: class {},
  SensorsRepository: class {},
}));

import type { Controller } from '@weber-nexus/repository';
import { ControllerXmlConfigService } from './controller-xml-config.service';

const controller: Pick<Controller, 'ipAddress' | 'model' | 'xmlConfig'> = {
  ipAddress: '192.168.1.1',
  model: 'DXM1200',
  xmlConfig: `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <file_info>
    <info device="DXM1200" filename="WLConfig.xml" guid="11111111-2222-3333-4444-555555555555" os="BannerOS" osversion="1.2.3" software="DXM Configurator" timestamp="" version="4.20.0.0" />
  </file_info>
  <local_regs />
  <rtu_read />
</configuration>`,
};

describe('ControllerXmlConfigService upload verification', () => {
  let service: ControllerXmlConfigService;

  beforeEach(() => {
    jest.useFakeTimers();
    mockUploadWlConfigXml.mockResolvedValue(undefined);
    mockCreateWlConfigUploadPlan.mockReturnValue({
      fileSizeBytes: 10,
      totalChunkBytes: 10,
      chunkCount: 1,
      chunkSizes: [10],
    });
    mockReadControllerLocalRegister.mockResolvedValue(1);
    mockLoggerDebug.mockClear();
    mockLoggerError.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerWarn.mockClear();

    service = new ControllerXmlConfigService({} as never, {} as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('schedules read-map verification without blocking upload metadata', async () => {
    await expect(
      service.uploadControllerConfig(controller, []),
    ).resolves.toEqual(
      expect.objectContaining({
        xmlConfig: expect.stringContaining('<configuration>'),
        xmlConfigChecksum: expect.any(String),
        xmlLastSyncedAt: expect.any(Date),
      }),
    );

    expect(mockUploadWlConfigXml).toHaveBeenCalledWith(expect.any(String), {
      host: '192.168.1.1',
    });
    expect(mockReadControllerLocalRegister).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(5000);

    expect(mockReadControllerLocalRegister).toHaveBeenCalledWith(10101, {
      host: '192.168.1.1',
      timeoutMs: 5000,
    });
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('Registrador virtual 10101'),
    );
  });

  it('logs verification failure without rejecting successful upload', async () => {
    mockReadControllerLocalRegister.mockRejectedValue(
      new Error('Controlador reiniciando'),
    );

    await expect(
      service.uploadControllerConfig(controller, []),
    ).resolves.toEqual(
      expect.objectContaining({
        xmlConfigChecksum: expect.any(String),
      }),
    );

    await jest.advanceTimersByTimeAsync(95000);

    expect(mockReadControllerLocalRegister).toHaveBeenCalledTimes(18);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Não foi possível ler o registrador virtual 10101',
      ),
      expect.any(Error),
    );
  });
});
