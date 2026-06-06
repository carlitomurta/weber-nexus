async function main() {
  // const xml = await getDXMConfigurationXML();
  // buildDXMConfigurationXML();
  // await setInterval(async () => {
  //   const registers = await getDXMHoldingRegisters();
  //   const xmlRegisters = Array.isArray(xml.configuration.local_regs.reg)
  //     ? xml.configuration.local_regs.reg
  //     : [xml.configuration.local_regs.reg];
  //   registers.forEach((registerValue: number, index: number) => {
  //     const xmlRegister = xmlRegisters[index];
  //     if (!xmlRegister) {
  //       console.warn(`No XML register found for index ${index}`);
  //       return;
  //     }
  //     let value = registerValue ?? 0;
  //     if (xmlRegister["@_scale_type"]) {
  //       if (xmlRegister["@_scale_type"] == "divide") {
  //         value = registerValue / Number(xmlRegister["@_scale_using"]);
  //       }
  //     }
  //     console.log(
  //       `${xmlRegister["@_name"]} - ${value === 13569 ? "OFFLINE" : value === 128 ? "ONLINE" : value}${xmlRegister["@_units"] || ""}`,
  //     );
  //   });
  // }, 2000);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
