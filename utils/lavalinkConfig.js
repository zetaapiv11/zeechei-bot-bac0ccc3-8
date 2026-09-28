/**
 * Lavalink connection normalizer.
 * Supports:
 *   - host: example.com + secure: true/false
 *   - host: https://example.com
 *   - host: http://example.com
 *   - host: wss://example.com
 *   - host: ws://example.com
 *   - LAVALINK_SECURE=true/false/auto
 */
function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value == null) return fallback;

  const v = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "ssl", "tls", "secure", "wss", "https"].includes(v)) return true;
  if (["false", "0", "no", "off", "plain", "insecure", "ws", "http"].includes(v)) return false;
  return fallback;
}

function normalizeLavalink(input = {}) {
  let rawHost = String(input.host || "").trim();
  let port = Number(input.port);
  if (!Number.isFinite(port) || port <= 0) port = 2333;

  let secure = parseBoolean(input.secure, false);
  const secureMode = String(input.secureMode ?? process.env.LAVALINK_SECURE ?? "auto")
    .trim()
    .toLowerCase();

  // A protocol in the host always wins. This makes copied Lavalink URLs work.
  const protocolMatch = rawHost.match(/^(wss?|https?):\/\//i);
  if (protocolMatch) {
    const protocol = protocolMatch[1].toLowerCase();
    secure = protocol === "wss" || protocol === "https";
    rawHost = rawHost.slice(protocolMatch[0].length);
  } else if (secureMode === "auto") {
    // Without a protocol, use the explicit port as a sensible default only for
    // the standard TLS port. Other ports remain plain unless configured.
    secure = port === 443 ? true : secure;
  } else {
    secure = parseBoolean(secureMode, secure);
  }

  // Remove paths, trailing slashes and accidental credentials/query strings.
  rawHost = rawHost.replace(/\/+$/, "");
  rawHost = rawHost.split("/")[0];
  rawHost = rawHost.split("?")[0];
  rawHost = rawHost.split("#")[0];

  // IPv6 host support: [::1] is valid, but strip brackets for library host fields.
  if (rawHost.startsWith("[") && rawHost.endsWith("]")) {
    rawHost = rawHost.slice(1, -1);
  }

  return {
    host: rawHost,
    port,
    password: String(input.password ?? ""),
    secure,
  };
}

function getLavalinkNodes(config) {
  const base = config?.lavalink || {};
  const rawNodes = process.env.LAVALINK_NODES;

  if (!rawNodes) return [normalizeLavalink(base)];

  const nodes = rawNodes
    .split(/[;,\n]+/)
    .map(v => v.trim())
    .filter(Boolean)
    .map((entry, index) => {
      // Supported: wss://host:443|password or host:2333|password
      const [endpoint, ...passwordParts] = entry.split("|");
      let url = endpoint.trim();
      let password = passwordParts.length ? passwordParts.join("|") : base.password;

      let protocol;
      try {
        const parsed = /^([a-z]+):\/\//i.test(url) ? new URL(url) : new URL(`http://${url}`);
        protocol = parsed.protocol;
        const host = parsed.hostname;
        const port = parsed.port ? Number(parsed.port) : (protocol === "wss:" || protocol === "https:" ? 443 : 2333);
        return {
          id: `zeechei-${index + 1}`,
          ...normalizeLavalink({
            host: protocol === "wss:" ? `wss://${host}` : protocol === "ws:" ? `ws://${host}` : protocol === "https:" ? `https://${host}` : `http://${host}`,
            port,
            password,
            secure: protocol === "wss:" || protocol === "https:",
          }),
        };
      } catch {
        return {
          id: `zeechei-${index + 1}`,
          ...normalizeLavalink({ host: url, password, secure: base.secure, port: base.port }),
        };
      }
    });

  return nodes.length ? nodes : [normalizeLavalink(base)];
}

module.exports = { parseBoolean, normalizeLavalink, getLavalinkNodes };
