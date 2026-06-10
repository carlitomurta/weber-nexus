import type { NewSensor } from '@weber-nexus/repository';
import { XMLValidator } from 'fast-xml-parser';
import {
  buildWlConfigXml,
  cleanWlConfigXml,
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

describe('WLConfig XML helpers', () => {
  it('cleans raw controller responses into XML', () => {
    const raw = `noise\x00\r\nRSP10021,ABCD,<?xml version="1.0" encoding="utf-8"?>\r\n<configuration>\x07</configuration>EOFafter`;

    expect(cleanWlConfigXml(raw)).toBe(
      '<?xml version="1.0" encoding="utf-8"?>\n<configuration></configuration>',
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
            scaleType: 'divide',
            scaleFactor: 10,
            unit: 'C',
            isHealthCheck: false,
          }),
          expect.objectContaining({
            name: 'Link',
            address: 18,
            unit: '',
            isHealthCheck: true,
          }),
        ],
      }),
    ]);
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
    expect(parsed.sensors[0].registers).toHaveLength(2);
  });
});
