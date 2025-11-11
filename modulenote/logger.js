import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, 'logs');
let logFilePath = '';

const LEVEL_ORDER = ['debug', 'info', 'warn', 'error'];

function ensureLogDirectory() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function resolveLogFileName() {
  const datePart = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `app-${datePart}.log`);
}

function writeLine(line) {
  if (!logFilePath) {
    initLogger();
  }

  try {
    fs.appendFileSync(logFilePath, `${line}\n`, { encoding: 'utf8' });
  } catch (error) {
    console.error('[Logger] 写入日志失败:', error);
  }
}

export function initLogger(filename) {
  ensureLogDirectory();
  logFilePath = filename
    ? path.join(LOG_DIR, filename)
    : resolveLogFileName();

  const header = `\n===== 日志初始化 ${new Date().toISOString()} =====`;
  writeLine(header);
  return logFilePath;
}

export function logMessage(level = 'info', message = '', meta) {
  const normLevel = LEVEL_ORDER.includes(level) ? level : 'info';
  const timestamp = new Date().toISOString();
  const metaText = meta
    ? ` ${JSON.stringify(meta, (_, value) =>
        value instanceof Error ? value.message : value,
      )}`
    : '';
  const line = `[${timestamp}] [${normLevel.toUpperCase()}] ${message}${metaText}`;

  writeLine(line);

  if (normLevel === 'error') {
    console.error(line);
  } else if (normLevel === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logError(error, context = '') {
  if (!error) return;
  const message = context
    ? `${context}: ${error.message || error}`
    : error.message || error;
  const meta = {
    stack: error.stack,
    context,
  };
  logMessage('error', message, meta);
}

export function getLogFilePath() {
  return logFilePath;
}

