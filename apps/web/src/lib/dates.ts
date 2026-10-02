const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
})
const dateOnly = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})

export const formatDateTime = (iso: string): string => `${dateTime.format(new Date(iso))} UTC`
export const formatDate = (iso: string): string => dateOnly.format(new Date(iso))
