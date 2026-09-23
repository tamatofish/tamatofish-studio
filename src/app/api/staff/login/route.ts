import { NextRequest, NextResponse } from "next/server";
import { verifyCaptcha } from "@/lib/captcha";
import { getSupabaseClient } from "@/storage/database/supabase-client";
import { HeaderUtils } from "coze-coding-dev-sdk";

/**
 * 内部成员登录：工号 + 图形验证码 + 密码。
 * 内部成员不开放自助注册，账号由工作室预置（工号映射到内部邮箱）。
 */
export async function POST(req: NextRequest) {
  HeaderUtils.extractForwardHeaders(req.headers);

  let body: {
    member_no?: string;
    password?: string;
    captcha_token?: string;
    captcha_code?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const memberNo = body.member_no?.trim();
  const password = body.password;
  if (!memberNo || !password) {
    return NextResponse.json({ error: "请输入工号和密码" }, { status: 400 });
  }
  if (!verifyCaptcha(body.captcha_token ?? "", body.captcha_code ?? "")) {
    return NextResponse.json(
      { error: "验证码错误或已过期，请刷新后重试" },
      { status: 400 },
    );
  }

  try {
    const client = await getSupabaseClient();

    // 工号统一大写存储
    const { data: member, error: memberError } = await client
      .from("internal_members")
      .select("id, user_id, name, email, status")
      .eq("member_no", memberNo.toUpperCase())
      .maybeSingle();

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }
    // 统一模糊提示，避免暴露工号是否存在
    if (!member || !member.email) {
      return NextResponse.json({ error: "工号或密码错误" }, { status: 401 });
    }
    if (member.status !== "active") {
      return NextResponse.json({ error: "该账号已停用，请联系管理员" }, { status: 403 });
    }

    const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
      email: member.email,
      password,
    });
    if (loginError || !loginData.session) {
      return NextResponse.json({ error: "工号或密码错误" }, { status: 401 });
    }

    return NextResponse.json({
      access_token: loginData.session.access_token,
      refresh_token: loginData.session.refresh_token,
      expires_at: loginData.session.expires_at,
      member: {
        id: member.id,
        member_no: memberNo.toUpperCase(),
        name: member.name,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "登录失败，请稍后重试" },
      { status: 500 },
    );
  }
}
