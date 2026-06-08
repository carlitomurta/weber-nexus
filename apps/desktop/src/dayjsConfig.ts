import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import timezone from "dayjs/plugin/timezone"; // dependent on utc plugin
import utc from "dayjs/plugin/utc";
import weekOfYear from "dayjs/plugin/weekOfYear"; // dependent on utc plugin

const executeDayJsPlugins = () => {
  dayjs.extend(utc);
  dayjs.extend(timezone);
  dayjs.extend(weekOfYear);
  dayjs.extend(isoWeek);
  dayjs.tz.setDefault("America/Sao_Paulo");
};

export const dayjsConfig = {
  executeDayJsPlugins,
};
