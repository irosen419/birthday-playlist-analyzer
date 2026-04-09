/**
 * Simple logger with color-coded output for different log levels.
 */

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function timestamp() {
  return new Date().toLocaleTimeString();
}

export const logger = {
  info(message, ...args) {
    console.log(`${COLORS.blue}[INFO]${COLORS.reset} ${COLORS.dim}${timestamp()}${COLORS.reset} ${message}`, ...args);
  },

  success(message, ...args) {
    console.log(`${COLORS.green}[SUCCESS]${COLORS.reset} ${COLORS.dim}${timestamp()}${COLORS.reset} ${message}`, ...args);
  },

  warn(message, ...args) {
    console.log(`${COLORS.yellow}[WARN]${COLORS.reset} ${COLORS.dim}${timestamp()}${COLORS.reset} ${message}`, ...args);
  },

  error(message, ...args) {
    console.error(`${COLORS.red}[ERROR]${COLORS.reset} ${COLORS.dim}${timestamp()}${COLORS.reset} ${message}`, ...args);
  },

  debug(message, ...args) {
    if (process.env.DEBUG) {
      console.log(`${COLORS.magenta}[DEBUG]${COLORS.reset} ${COLORS.dim}${timestamp()}${COLORS.reset} ${message}`, ...args);
    }
  },

  section(title) {
    console.log(`\n${COLORS.cyan}${COLORS.bright}=== ${title} ===${COLORS.reset}\n`);
  },

  divider() {
    console.log(`${COLORS.dim}${'─'.repeat(50)}${COLORS.reset}`);
  },
};
