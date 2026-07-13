import { z } from "zod";

const isoTimestampPattern = /^(?<year>[0-9]{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12][0-9]|3[01])T(?<hour>[01][0-9]|2[0-3]):(?<minute>[0-5][0-9]):(?<second>[0-5][0-9])(?:\.[0-9]+)?(?:Z|[+-](?:[01][0-9]|2[0-3]):[0-5][0-9])$/u;

const calendarDateIsValid = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const isoTimestamp = z.string().transform((value, context) => {
  const match = isoTimestampPattern.exec(value);
  const groups = match?.groups;
  if (groups === undefined) {
    context.addIssue({ code: "custom", message: "Invalid value" });
    return z.NEVER;
  }
  const year = Number(groups.year);
  const month = Number(groups.month);
  const day = Number(groups.day);
  const parsed = new Date(value);
  if (!calendarDateIsValid(year, month, day) || Number.isNaN(parsed.getTime())) {
    context.addIssue({ code: "custom", message: "Invalid value" });
    return z.NEVER;
  }
  return parsed;
});
