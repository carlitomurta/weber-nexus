import {
  chunkBuffer,
  encodeXmlForController,
  formatModbusCrc16,
} from './controller-file-transfer';

describe('controller file transfer helpers', () => {
  it('encodes line endings for controller upload', () => {
    expect([...encodeXmlForController('a\r\nb\nc\rd')]).toEqual([
      0x61, 0x1e, 0x1f, 0x62, 0x1f, 0x63, 0x1e, 0x64,
    ]);
  });

  it('chunks buffers by maximum byte size', () => {
    const chunks = chunkBuffer(Buffer.from('abcdef'), 2);

    expect(chunks.map((chunk) => chunk.toString('utf8'))).toEqual([
      'ab',
      'cd',
      'ef',
    ]);
  });

  it('calculates Modbus CRC16 as uppercase hex', () => {
    expect(formatModbusCrc16(Buffer.from('123456789', 'utf8'))).toBe('4B37');
  });
});
