const ANSI_REGEX = /[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

function cleanLogs(rawLogs) {
  let cleaned = rawLogs;

  cleaned = cleaned.replace(ANSI_REGEX, "");

  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  cleaned = cleaned
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (/^::group::|^::endgroup::/i.test(trimmed)) return false;
      if (/^::set-output|^::add-mask|^::debug/i.test(trimmed)) return false;
      if (/^##\[group\]|^##\[endgroup\]/i.test(trimmed)) return false;
      if (/^Downloading|^Extracting|^\d+\.\d+%/i.test(trimmed)) return false;
      return true;
    })
    .join("\n");

  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  const maxLength = 50000;
  if (cleaned.length > maxLength) {
    const errorSection = extractErrorSection(cleaned);
    if (errorSection.length < maxLength) {
      cleaned = errorSection;
    } else {
      cleaned = cleaned.substring(cleaned.length - maxLength);
    }
  }

  return cleaned.trim();
}

function extractErrorSection(logs) {
  const lines = logs.split("\n");
  const errorLines = [];
  let capturing = false;
  let captureCount = 0;
  const maxCapture = 100;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isError = /error:|Error:|ERROR|failed|FAILED|exception|Exception|FATAL/i.test(line);

    if (isError && !capturing) {
      capturing = true;
      const start = Math.max(0, i - 5);
      for (let j = start; j < i; j++) {
        errorLines.push(lines[j]);
        captureCount++;
      }
    }

    if (capturing) {
      errorLines.push(line);
      captureCount++;
      if (captureCount >= maxCapture) break;
    }
  }

  if (errorLines.length === 0) {
    return lines.slice(-50).join("\n");
  }

  return errorLines.join("\n");
}

module.exports = { cleanLogs, extractErrorSection };
