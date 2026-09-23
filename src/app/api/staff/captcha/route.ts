import { NextResponse } from "next/server";
import { generateCaptchaCode, renderCaptchaSvg, signCaptcha } from "@/lib/captcha";

export async function GET() {
  const code = generateCaptchaCode();
  const { token, expiresAt } = signCaptcha(code);
  return NextResponse.json({
    svg: renderCaptchaSvg(code),
    token,
    expires_in: Math.max(1, Math.floor((expiresAt - Date.now()) / 1000)),
  });
}
