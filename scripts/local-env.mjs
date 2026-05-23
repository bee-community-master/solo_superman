export function envValue(env, name, fallback) {
  const value = env[name];

  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export function positiveIntegerEnv(env, name, fallback, description = "positive integer") {
  const value = envValue(env, name, String(fallback));

  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a ${description}; received ${JSON.stringify(value)}`);
  }

  return Number.parseInt(value, 10);
}

export function fixedLocalPortEnv(env, name, fallback) {
  const value = envValue(env, name, fallback);

  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a numeric fixed local port: ${value}`);
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`${name} must be a fixed local port between 1 and 65535: ${value}`);
  }

  return String(parsed);
}
