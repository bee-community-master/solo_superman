export function formatHttpOrigin(host, port) {
  const normalizedHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const urlHost = normalizedHost.includes(":") ? `[${normalizedHost}]` : normalizedHost;

  return `http://${urlHost}:${port}`;
}
