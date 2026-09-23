import crypto from "node:crypto";

/**
 * 轻量图形验证码：无状态 HMAC 签名方案。
 * token = base64url(payload).hmac，payload 只含验证码哈希与过期时间，
 * 不泄露验证码明文；服务端不保存任何状态，重启后旧 token 自动失效（可接受）。
 */

const SECRET = crypto.randomBytes(32);
const TTL_MS = 5 * 60 * 1000;
// 去掉易混淆字符（0/O、1/I/L）
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function hmac(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function generateCaptchaCode(length = 4): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARS[crypto.randomInt(CHARS.length)];
  }
  return code;
}

export function signCaptcha(code: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TTL_MS;
  const codeHash = hmac(code.trim().toUpperCase());
  const payload = JSON.stringify({ ch: codeHash, exp: expiresAt });
  const body = Buffer.from(payload).toString("base64url");
  return { token: `${body}.${hmac(body)}`, expiresAt };
}

export function verifyCaptcha(token: string, input: string): boolean {
  if (!token || !input) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;

  const expected = Buffer.from(hmac(body));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      ch?: unknown;
      exp?: unknown;
    };
    if (typeof payload.ch !== "string" || typeof payload.exp !== "number") return false;
    if (Date.now() > payload.exp) return false;
    const inputHash = hmac(input.trim().toUpperCase());
    const a = Buffer.from(inputHash);
    const b = Buffer.from(payload.ch);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const SVG_COLORS = ["#67e8f9", "#a5b4fc", "#fda4af", "#fcd34d", "#86efac"];

export function renderCaptchaSvg(code: string, width = 128, height = 44): string {
  const charWidth = (width - 16) / code.length;
  const parts: string[] = [];

  // 干扰曲线
  for (let i = 0; i < 3; i++) {
    const y = 8 + crypto.randomInt(height - 16);
    parts.push(
      `<path d="M4 ${y} C ${width * 0.3} ${crypto.randomInt(height)}, ${width * 0.6} ${crypto.randomInt(height)}, ${width - 4} ${crypto.randomInt(height)}" stroke="${SVG_COLORS[crypto.randomInt(SVG_COLORS.length)]}" stroke-width="1" fill="none" opacity="0.35" />`,
    );
  }

  code.split("").forEach((ch, i) => {
    const x = 8 + i * charWidth + charWidth / 2;
    const y = height / 2 + 6 + (crypto.randomInt(7) - 3);
    const rotate = crypto.randomInt(41) - 20;
    const color = SVG_COLORS[crypto.randomInt(SVG_COLORS.length)];
    parts.push(
      `<text x="${x}" y="${y}" font-family="'Courier New',monospace" font-size="24" font-weight="bold" fill="${color}" text-anchor="middle" transform="rotate(${rotate} ${x} ${height / 2})" opacity="0.9">${ch}</text>`,
    );
  });

  // 噪点
  for (let i = 0; i < 14; i++) {
    parts.push(
      `<circle cx="${crypto.randomInt(width)}" cy="${crypto.randomInt(height)}" r="${(crypto.randomInt(15) + 5) / 10}" fill="${SVG_COLORS[crypto.randomInt(SVG_COLORS.length)]}" opacity="0.4" />`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="验证码">${parts.join("")}</svg>`;
}
