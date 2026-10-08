const numeric = /^\d+(?:\.\d+)?$/;
const color = /^(?:#[0-9a-fA-F]{3,8}|black|white|none)$/;
const styleValue = /^(?:#[0-9a-fA-F]{3,8}|black|white|none|rgb\(\d{1,3},\d{1,3},\d{1,3}\)|(?:0|\d+(?:\.\d+)?)(?:px)?|crispEdges|geometricPrecision)$/;
const styleProperty = /^(?:fill|stroke|stroke-width|shape-rendering|fill-opacity|stroke-opacity)$/;
function safeStyle(raw: string): boolean {
  const declarations = raw.split(";").map((entry) => entry.trim()).filter(Boolean);
  return declarations.length > 0 && declarations.length <= 8 && declarations.every((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator < 1) return false;
    const property = declaration.slice(0, separator).trim();
    const value = declaration.slice(separator + 1).replace(/\s+/g, "");
    return styleProperty.test(property) && styleValue.test(value);
  });
}
const attributes: Record<string, Record<string, RegExp | ((raw: string) => boolean)>> = {
  svg: { xmlns: /^http:\/\/www\.w3\.org\/2000\/svg$/, width: numeric, height: numeric,
    viewBox: /^\d+(?:\.\d+)?(?:\s+\d+(?:\.\d+)?){3}$/, version: /^1\.[01]$/,
    "xmlns:xlink": /^http:\/\/www\.w3\.org\/1999\/xlink$/ },
  g: {},
  path: { d: /^[MmLlHhVvZzCcSsQqTtAa0-9.,+\s-]+$/ },
  rect: { x: numeric, y: numeric, width: numeric, height: numeric, style: safeStyle },
};
const sharedAttributes: Record<string, RegExp | ((raw: string) => boolean)> = {
  fill: color, stroke: color, "stroke-width": numeric, "shape-rendering": /^(?:crispEdges|geometricPrecision)$/,
};

function safeAttributes(tag: string, raw: string): boolean {
  const seen = new Set<string>();
  let consumed = "";
  for (const match of raw.matchAll(/\s+([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    const [text, name, doubleValue, singleValue] = match;
    if (!name || seen.has(name)) return false;
    const validator = attributes[tag]?.[name] ?? sharedAttributes[name];
    const value = doubleValue ?? singleValue ?? "";
    if (!validator || (typeof validator === "function" ? !validator(value) : !validator.test(value))) return false;
    seen.add(name); consumed += text;
  }
  return consumed.trim() === raw.trim() && (tag !== "svg" || seen.has("xmlns"));
}

export function safeTotpQrDataUri(source: string): string | null {
  const prefix = /^data:image\/svg\+xml;(?:utf-8|utf8|charset=utf-8),/i.exec(source)?.[0];
  if (!prefix || source.length > 400000) return null;
  const svg = source.slice(prefix.length).trim()
    .replace(/^<\?xml\s+version="1\.0"(?:\s+encoding="UTF-8")?(?:\s+standalone="(?:yes|no)")?\s*\?>\s*/i, "")
    .replace(/<!--[^]*?-->/g, "")
    .trim();
  if (/<!--|-->/u.test(svg)) return null;
  // Accept only inert QR geometry; unusual provider output falls back to manual setup.
  if (!/^<svg\s/.test(svg) || !svg.endsWith("</svg>") || /[&\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(svg)) return null;
  const tokens = svg.match(/<[^>]*>|[^<]+/g);
  if (!tokens || tokens.join("") !== svg) return null;
  const stack: string[] = [];
  let roots = 0;
  for (const token of tokens) {
    if (!token.startsWith("<")) { if (token.trim()) return null; continue; }
    const closing = /^<\/(svg|g|path|rect)\s*>$/.exec(token);
    if (closing) { if (stack.pop() !== closing[1]) return null; continue; }
    const opening = /^<(svg|g|path|rect)(\s[^<>]*?)?\s*(\/?)>$/.exec(token);
    if (!opening?.[1]) return null;
    const tag = opening[1];
    if (tag === "svg") { if (roots++ !== 0 || stack.length) return null; }
    else if (!stack.length || ["path", "rect"].includes(stack[stack.length - 1] ?? "")) return null;
    if (!safeAttributes(tag, opening[2] ?? "")) return null;
    if (!opening[3]) stack.push(tag);
  }
  if (roots !== 1 || stack.length) return null;
  // The provider's QR paths are large; encode URI-safe characters compactly while
  // escaping fragment markers so the data cannot be truncated as a URL fragment.
  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURI(svg).replace(/#/g, "%23")}`;
  return encoded.length <= 500000 ? encoded : null;
}
