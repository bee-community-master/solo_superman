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
