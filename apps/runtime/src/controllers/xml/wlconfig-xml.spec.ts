import type { NewSensor } from '@weber-nexus/repository';
import { XMLValidator } from 'fast-xml-parser';
import {
  buildWlConfigXml,
  cleanWlConfigXml,
  formatWlConfigTimestamp,
  hasReusableWlConfigFileInfo,
  hasWlConfigFileInfo,
  parseWlConfigXml,
} from './wlconfig-xml';

const validXml = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <local_regs>
    <reg cloudio="1" iot="1" lcd="1" logfiles="8" name="Temp" num="1" perms="1" scale_type="divide" scale_using="10" units="C" />
    <reg cloudio="1" iot="1" lcd="1" logfiles="8" name="Link" num="2" perms="1" />
  </local_regs>
  <rtu_read>
    <rule count="2" default="0" localreg="1" mask="0" maxfail="0" name="Node 1" offset="0" poll="1" remfmt="int" remreg="17" remtype="hold_reg" scale="0" swapped="0" unit="1" />
  </rtu_read>
</configuration>`;

const xmlWithFileInfo = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <file_info>
    <info device="DXM1200" filename="WLConfig.xml" guid="00000000-0000-0000-0000-000000000000" os="BannerOS" osversion="1.2.3" software="DXM Configurator" solution="Factory" timestamp="" version="4.20.0.0" />
  </file_info>
  <local_regs />
  <rtu_read />
</configuration>`;

const reusableXmlWithFileInfo = xmlWithFileInfo.replace(
  'guid="00000000-0000-0000-0000-000000000000"',
  'guid="11111111-2222-3333-4444-555555555555"',
);
const syntheticXmlWithFileInfo = reusableXmlWithFileInfo.replace(
  'os="BannerOS"',
  'os="Nexus"',
);

describe('WLConfig XML helpers', () => {
  it('cleans raw controller responses into XML', () => {
    const raw = `noise\x00\r\nRSP10021,ABCD,<?xml version="1.0" encoding="utf-8"?>\r\n<configuration>\x07</configuration>EOFafter`;

    expect(cleanWlConfigXml(raw)).toBe(
      '<?xml version="1.0" encoding="utf-8"?>\n<configuration></configuration>',
    );
  });

  it('restores controller encoded line endings while cleaning XML', () => {
    const raw = 'RSP100232,ABCD,<?xml version="1.0"?>\x1F<configuration />EOF';

    expect(cleanWlConfigXml(raw)).toBe(
      '<?xml version="1.0"?>\n<configuration />',
    );
  });

  it('parses attributes and maps rules to sensors', () => {
    const parsed = parseWlConfigXml(validXml);

    expect(parsed.sensors).toEqual([
      expect.objectContaining({
        nodeId: 1,
        name: 'Node 1',
        registers: [
          expect.objectContaining({
            name: 'Temp',
            address: 17,
            localRegisterNumber: 1,
            scaleType: 'divide',
            scaleFactor: 10,
            unit: 'C',
            isHealthCheck: false,
          }),
          expect.objectContaining({
            name: 'Link',
            address: 18,
            localRegisterNumber: 2,
            unit: '',
            isHealthCheck: true,
          }),
        ],
      }),
    ]);
  });

  it('rejects WLConfig XML with more than one status register for a node', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <local_regs>
    <reg name="N1 Link A" num="1" perms="1" />
    <reg name="N1 Link B" num="2" perms="1" />
  </local_regs>
  <rtu_read>
    <rule count="1" localreg="1" name="N1-Link-A" remreg="24" />
    <rule count="1" localreg="2" name="N1-Link-B" remreg="25" />
  </rtu_read>
</configuration>`;

    expect(() => parseWlConfigXml(xml)).toThrow(
      'Nó 1 deve ter apenas um registrador de status',
    );
  });

  it('reads controller model from file info device', () => {
    const parsed = parseWlConfigXml(xmlWithFileInfo);

    expect(parsed.controllerModel).toBe('DXM1200');
  });

  it('rejects invalid XML before parsing', () => {
    expect(() => parseWlConfigXml('<configuration>')).toThrow(
      'WLConfig.xml inválido',
    );
  });

  it('builds valid XML with generated registers and rules', () => {
    const sensor: NewSensor = {
      controllerId: 1,
      nodeId: 2,
      name: 'Pump',
      description: null,
      model: null,
      location: null,
      operationalStatus: 'active',
      registers: [
        {
          name: 'Velocity',
          address: 33,
          scaleType: 'divide',
          scaleFactor: 1000,
          unit: 'mm/s',
        },
        {
          name: 'Health',
          address: 34,
          unit: '',
          isHealthCheck: true,
        },
      ],
      deletedAt: null,
    };

    const result = buildWlConfigXml(validXml, [sensor]);
    const parsed = parseWlConfigXml(result.xml);

    expect(XMLValidator.validate(result.xml)).toBe(true);
    expect(result.xml).toContain('name="Velocity"');
    expect(result.xml).toContain('scale_type="divide"');
    expect(result.xml).toContain('scale_using="1000"');
    expect(result.xml).toContain('count="2"');
    expect(parsed.sensors[0].registers[0]).toEqual(
      expect.objectContaining({
        address: 33,
        localRegisterNumber: 1,
      }),
    );
    expect(parsed.sensors[0].registers).toHaveLength(2);
  });

  it('rejects generated XML with more than one status register for a node', () => {
    const sensors: NewSensor[] = [
      {
        controllerId: 1,
        nodeId: 2,
        name: 'N2-Link-A',
        description: null,
        model: null,
        location: null,
        operationalStatus: 'active',
        registers: [
          {
            name: 'Link A',
            address: 40,
            unit: '',
            isHealthCheck: true,
          },
        ],
        deletedAt: null,
      },
      {
        controllerId: 1,
        nodeId: 2,
        name: 'N2-Link-B',
        description: null,
        model: null,
        location: null,
        operationalStatus: 'active',
        registers: [
          {
            name: 'Link B',
            address: 39,
            unit: '',
            isHealthCheck: true,
          },
        ],
        deletedAt: null,
      },
    ];

    expect(() => buildWlConfigXml(validXml, sensors)).toThrow(
      'Nó 2 deve ter apenas um registrador de status',
    );
  });

  it('updates file info using controller model and upload timestamp', () => {
    const result = buildWlConfigXml(xmlWithFileInfo, [], {
      controllerModel: 'DXM700',
      guid: '11111111-2222-3333-4444-555555555555',
      now: new Date('2026-06-10T13:45:06.000Z'),
    });

    expect(result.xml).toContain('device="DXM700"');
    expect(result.xml).toContain('guid="11111111-2222-3333-4444-555555555555"');
    expect(result.xml).toContain('os="BannerOS"');
    expect(result.xml).toContain('osversion="1.2.3"');
    expect(result.xml).toContain('software="DXM Configurator"');
    expect(result.xml).toContain('solution="Factory"');
    expect(result.xml).toContain('version="4.20.0.0"');
    expect(result.xml).toContain('timestamp="10/06/2026 13:45:06"');
  });

  it('detects XML snapshots with controller file info', () => {
    expect(hasWlConfigFileInfo(xmlWithFileInfo)).toBe(true);
    expect(hasWlConfigFileInfo('<configuration />')).toBe(false);
  });

  it('does not reuse synthetic Nexus template metadata', () => {
    expect(hasReusableWlConfigFileInfo(reusableXmlWithFileInfo)).toBe(true);
    expect(hasReusableWlConfigFileInfo(syntheticXmlWithFileInfo)).toBe(false);
    expect(hasReusableWlConfigFileInfo(xmlWithFileInfo)).toBe(false);
  });

  it('formats WLConfig timestamps in UTC', () => {
    expect(formatWlConfigTimestamp(new Date('2026-01-02T03:04:05.000Z'))).toBe(
      '02/01/2026 03:04:05',
    );
  });
});
