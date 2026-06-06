import { XMLBuilder, XMLParser } from "fast-xml-parser";
import fs from "fs";
import net from "net";

const TEMP_DIR = new URL("../temp/", import.meta.url);
const CONFIG_XML_PATH = new URL("WLConfig.xml", TEMP_DIR);
const EDITED_XML_PATH = new URL("editted.xml", TEMP_DIR);

export async function getDXMConfigurationXML() {
  return new Promise<any>((resolve, reject) => {
    const HOST = "192.168.1.1";
    const PORT = 8844;

    let chunkId = 1;
    let started = false;
    let finished = false;
    let rawResponse = "";

    const socket = new net.Socket();
    const parser = new XMLParser({ ignoreAttributes: false });

    const isXMLExists = fs.existsSync(CONFIG_XML_PATH);
    if (isXMLExists) {
      const xml = fs.readFileSync(CONFIG_XML_PATH, "utf-8");
      resolve(parser.parse(xml));
      return;
    }

    socket.connect(PORT, HOST, () => {
      socket.write("CMD1001 WLConfig.xml,0,0,0\r\n");
    });

    socket.on("data", (data: Buffer) => {
      if (finished) {
        return;
      }

      rawResponse += data.toString("utf8");

      if (rawResponse.includes("EOF")) {
        finished = true;

        socket.write("CMD1003\r\n");

        try {
          const cleaned = cleanDXMXml(rawResponse);

          // Parse XML -> JSON
          const xmlJson = parser.parse(cleaned);

          fs.mkdirSync(TEMP_DIR, { recursive: true });
          fs.writeFileSync(CONFIG_XML_PATH, cleaned, "utf8");

          socket.end();

          resolve(xmlJson);
        } catch (err) {
          reject(new Error("XML inválido"));
        }

        return;
      }

      if (!started) {
        const match = rawResponse.match(/^RSP1001(.+)$/);

        if (!match) {
          reject(new Error(`Resposta inesperada: ${rawResponse}`));
          socket.destroy();
          return;
        }

        started = true;

        socket.write(`CMD1002 ${chunkId}\r\n`);

        return;
      }

      chunkId += 1;
      socket.write(`CMD1002 ${chunkId}\r\n`);
    });

    socket.on("close", () => {
      console.log("Conexão encerrada");
    });

    socket.on("error", (err) => {
      reject(err);
    });
  });
}

export function cleanDXMXml(raw: string): string {
  let cleaned = raw;

  /**
   * remove EOF
   */
  cleaned = cleaned.replace(/\bEOF\b/g, "");

  /**
   * remove TODOS headers RSP1002
   * mesmo quebrados por newline
   */
  cleaned = cleaned.replace(/RSP1002\d+,[a-fA-F0-9]+,/gms, "");

  /**
   * remove caracteres de controle
   */
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  /**
   * encontra XML real
   */
  const start = cleaned.indexOf("<?xml");

  if (start >= 0) {
    cleaned = cleaned.slice(start);
  }

  /**
   * encontra fechamento real
   */
  const endTag = "</configuration>";
  const end = cleaned.lastIndexOf(endTag);

  if (end >= 0) {
    cleaned = cleaned.slice(0, end + endTag.length);
  }

  /**
   * normaliza CRLF
   */
  cleaned = cleaned.replace(/\r\n/g, "\n");
  cleaned = cleaned.replace(/\r/g, "\n");

  /**
   * remove linhas vazias excessivas
   */
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

export function buildDXMConfigurationXML() {
  const xmlToEdit = fs.readFileSync(CONFIG_XML_PATH, "utf-8");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const json = parser.parse(xmlToEdit);

  const regs = json.configuration.local_regs.reg;
  const registers = Array.isArray(regs) ? regs : [regs];

  const target = registers.find((d) => d["@_name"] === "RH");

  if (target) {
    target["@_name"] = "Umidade";
  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
  });

  const updatedXml = builder.build(json);

  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.writeFileSync(EDITED_XML_PATH, updatedXml);

  console.log("XML atualizado");
}
