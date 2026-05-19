import { hasProcessExited } from "./local-processes.mjs";

const FETCH_RETRY_INTERVAL_MS = 250;

function remainingTimeoutMs(startedAt, timeoutMs) {
  return Math.max(1, timeoutMs - (Date.now() - startedAt));
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(url, options) {
  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  try {
    return await fetchImpl(url, {
      headers: options.headers,
      signal: controller.signal
    });
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function waitForFetch(url, options) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < options.timeoutMs) {
    if (options.processes?.some(hasProcessExited)) {
      const exited = options.processes.find(hasProcessExited);

      throw new Error(`${exited.label} exited before ${url} became ready.\n${exited.logs.join("")}`);
    }

    try {
      const response = await fetchWithTimeout(url, {
        headers: options.headers,
        timeoutMs: remainingTimeoutMs(startedAt, options.timeoutMs)
      });
      const text = await response.text();

      if (response.status === options.expectedStatus && (!options.textIncludes || text.includes(options.textIncludes))) {
        return { response, text };
      }

      lastError = new Error(`${url} returned ${response.status}; expected ${options.expectedStatus}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(FETCH_RETRY_INTERVAL_MS);
  }

  throw lastError ?? new Error(`${url} did not become ready within ${options.timeoutMs}ms`);
}
