export const DEFAULT_WLCONFIG_TEMPLATE_XML = `<?xml version="1.0" encoding="utf-8"?>
<configuration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <file_info>
    <info device="DXM1200" filename="WLConfig.xml" guid="00000000-0000-0000-0000-000000000000" os="Nexus" osversion="Nexus" software="Nexus" solution="None" timestamp="" version="4.19.8.0" />
  </file_info>
  <local_regs />
  <cascade />
  <constant />
  <calculate />
  <thresholds />
  <trend />
  <rtu_read />
  <rtu_write />
  <modbus_tcp>
    <server enabled="1" inact="600000" />
  </modbus_tcp>
  <sched_holidays />
  <sched_commands />
  <sched_events />
  <astro_clock>
    <set dst="0" lat="0" lon="0" zone="-3" />
  </astro_clock>
  <gps>
    <unit addr="0" enabled="0" flags="0" lograte="00:00:00" poll="00:00:00" />
  </gps>
  <master_mode>
    <mode opt="1" state="0" />
  </master_mode>
  <rtu_device>
    <dev baud="19200" commtype="485" data="8" parity="0" rate="50" stop="1" thisUnit="0" timeout="5" />
    <bus baud="19200" commtype="4" data="8" parity="0" rate="50" stop="1" thisUnit="255" timeout="5" />
  </rtu_device>
  <rtu_server>
    <dev baud="19200" commtype="485" data="8" parity="0" stop="1" timeout="0" />
  </rtu_server>
  <scripts>
    <script baud="19200" data="8" delay="20000" enabled="0" parity="0" path="" stop="1" />
  </scripts>
  <timekeepers>
    <timekeeper address="0.0.0.0" enabled="1" interval="0" name="external" priority="3" />
    <timekeeper address="0.0.0.0" enabled="0" interval="0" name="internal" priority="2" />
    <timekeeper address="0.0.0.0" enabled="0" interval="0" name="network" priority="1" />
  </timekeepers>
  <system_types />
  <log_files />
  <device_sync>
    <device sync_rollover="100000000" />
  </device_sync>
  <email_server>
    <server auth="" domain="" pass="" pop3="" pop3domain="" pop3user="" port="25" pwd="" smtp="" sysrep="0" useauth="0" user="" />
  </email_server>
  <server_params>
    <server apn="IP" apnpass="" cellenab="0" cellfw="0.0.0.0" cellfwmask="255.255.255.0" defaddr="0.0.0.0" defgtwy="0.0.0.0" defmask="255.255.255.0" dhcp="1" sms="0" />
    <cell_info cell_modelname="" />
    <maint cexch="0" ckeep="0" csflags="0" csqbak="0" csqret="5" csrvre="0" csrvwd="0" linkdel="60000" linkmax="120000" linkret="2" />
    <eth flags="0" />
    <netif flags="0" gw4="0.0.0.0" ip4="0.0.0.0" mode="1" sn4="0.0.0.0" />
  </server_params>
  <http_push>
    <dns address="0.0.0.0" />
    <dns address="0.0.0.0" />
    <push debug="0" enabled="0" flags="4104" host="" id="00000000-0000-0000-0000-000000000000" interval="00:00:00" page="" port="80" vendor="0" />
  </http_push>
  <fwall />
  <profinet>
    <io en="0" flags="0" />
  </profinet>
  <iot>
    <mqtt debug="0" en="0" flags="5" host="" id=" " ping="50000" port="8883" throttle="0" vendor="7" />
  </iot>
</configuration>`;
