// Minimal structured logger. Swap for winston/pino later without touching
// call sites — every module logs through this, never console.* directly.

const levelColor = {
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  debug: "\x1b[90m", // gray
};
const reset = "\x1b[0m";

function log(level, message, meta) {
  const timestamp = new Date().toISOString();
  const color = levelColor[level] || "";
  const base = `${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`;
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](base, meta);
  } else {
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](base);
  }
}

module.exports = {
  info: (message, meta) => log("info", message, meta),
  warn: (message, meta) => log("warn", message, meta),
  error: (message, meta) => log("error", message, meta),
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== "production") log("debug", message, meta);
  },
};
