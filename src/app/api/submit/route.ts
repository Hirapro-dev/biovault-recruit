import { NextResponse } from "next/server";
import { Resend } from "resend";
import { put } from "@vercel/blob";
import { submissionSchema, type Submission } from "@/lib/form";

export const runtime = "nodejs";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 生年月日から満年齢を算出
function calcAge(year: string, month: string, day: string): string {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) return "";
  const today = new Date();
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m ||
    (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return String(age);
}

// 郵便番号を 〒123-4567 形式に整形（7桁の数字なら区切りを付与）
function normalizePostal(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length === 7) {
    return `〒${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  const t = value.trim();
  return t.startsWith("〒") ? t : `〒${t}`;
}

function parsePhoto(
  dataUrl: string,
): { buffer: Buffer; mime: string; ext: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[2];
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  return { buffer: Buffer.from(base64, "base64"), mime, ext };
}

type FieldRow = { label: string; value: string };

// 職歴1件分を「会社名 勤続X年」に整形（会社名が空なら空文字）
function workLine(company: string, years: string): string {
  if (!company.trim()) return "";
  return years.trim() ? `${company} 勤続${years}年` : company;
}

// テンプレート順にフィールドを組み立てる
function buildFields(d: Submission, photoUrl: string): FieldRow[] {
  return [
    { label: "顔写真", value: photoUrl },
    { label: "お名前", value: d.name },
    { label: "ふりがな", value: d.furigana },
    { label: "性別", value: d.gender },
    { label: "生年月日", value: `${d.birthYear}年${d.birthMonth}月${d.birthDay}日` },
    { label: "年齢", value: calcAge(d.birthYear, d.birthMonth, d.birthDay) },
    { label: "郵便番号", value: normalizePostal(d.postalCode) },
    { label: "住所", value: `${d.address1} ${d.address2}`.trim() },
    { label: "電話番号", value: d.phone },
    { label: "メールアドレス", value: d.email },
    { label: "希望職種", value: d.desiredJob },
    { label: "入墨・タトゥー", value: d.tattoo },
    { label: "喫煙", value: d.smoking },
    { label: "最終学歴", value: `${d.educationSchool} ${d.educationGradYear}年卒業` },
    { label: "職歴1", value: workLine(d.work1Company, d.work1Years) },
    { label: "職歴2", value: workLine(d.work2Company, d.work2Years) },
    { label: "職歴3", value: workLine(d.work3Company, d.work3Years) },
    { label: "資格・免許", value: d.qualifications },
    { label: "趣味・特技", value: d.hobby },
    { label: "志望動機・自己PR", value: d.motivation },
    { label: "備考", value: d.remarks },
  ];
}

// テンプレート（プレーンテキスト）形式
function buildText(fields: FieldRow[]): string {
  return fields.map((f) => `【${f.label}】\n${f.value}`).join("\n\n");
}

// 応募者への自動返信メール
const AUTO_REPLY_SUBJECT = "【株式会社BioVault】ご応募いただき誠にありがとうございます。";

const AUTO_REPLY_BODY = `この度は、株式会社BioVaultに
ご応募いただき、誠にありがとうございます＾＾


お送りいただいた内容を確認させていただいた後、
改めてお電話、もしくはメールにてご連絡させていただきます。


なにか気になることなどありましたらお気軽にご連絡ください。


                          株式会社BioVault 採用グループ



□■――――――――――――――■□
株式会社BioVault 採用グループ
採用問い合わせ：recruit@biovault.co.jp
電話番号：0120-325-699
会社HP：https://biovault.co.jp/
□■――――――――――――――■□
(c) 株式会社BioVault All Rights Reserved.`;

// 応募者の氏名を冒頭に差し込む
function autoReplyText(name: string): string {
  return `${name} 様\n\n${AUTO_REPLY_BODY}`;
}

function autoReplyHtml(name: string): string {
  return `<div style="font-family:sans-serif;color:#111;font-size:14px;line-height:1.8;white-space:pre-wrap;">${escapeHtml(autoReplyText(name))}</div>`;
}

// HTML 版（同じ並び・体裁）
function buildHtml(fields: FieldRow[]): string {
  const rows = fields
    .map((f) => {
      const isPhotoUrl = f.label === "顔写真" && /^https?:\/\//.test(f.value);
      const value = isPhotoUrl
        ? `<a href="${escapeHtml(f.value)}">${escapeHtml(f.value)}</a>`
        : escapeHtml(f.value).replace(/\n/g, "<br>") || "（未入力）";
      return `<p style="margin:0 0 14px;"><strong>【${f.label}】</strong><br>${value}</p>`;
    })
    .join("");
  return `<div style="font-family:sans-serif;color:#111;font-size:14px;line-height:1.7;max-width:680px;">${rows}</div>`;
}

function parseNotifyTo(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((email) => email.trim())
      .filter(Boolean) ?? []
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = parseNotifyTo(process.env.RECRUIT_NOTIFY_TO);
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  if (!apiKey || notifyTo.length === 0 || !blobToken) {
    console.error(
      "RESEND_API_KEY / RECRUIT_NOTIFY_TO / BLOB_READ_WRITE_TOKEN のいずれかが未設定です",
    );
    return NextResponse.json(
      { error: "サーバー設定が未完了です。管理者にお問い合わせください。" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { error: "入力内容に誤りがあります。", fieldErrors },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const photo = parsePhoto(data.photo);
  if (!photo) {
    return NextResponse.json(
      { error: "顔写真の形式が不正です。", fieldErrors: { photo: ["顔写真を再添付してください"] } },
      { status: 400 },
    );
  }

  // 顔写真を Vercel Blob に保存して公開URLを取得
  let photoUrl: string;
  try {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const blob = await put(`recruit/${stamp}.${photo.ext}`, photo.buffer, {
      access: "public",
      contentType: photo.mime,
      addRandomSuffix: true,
      token: blobToken,
    });
    photoUrl = blob.url;
  } catch (e) {
    console.error("Blob アップロード失敗:", e);
    return NextResponse.json(
      { error: "画像のアップロードに失敗しました。時間をおいて再度お試しください。" },
      { status: 502 },
    );
  }

  const fields = buildFields(data, photoUrl);
  const fromHeader = `株式会社BioVault 採用グループ <${from}>`;

  const resend = new Resend(apiKey);

  // 1. 採用担当への通知メール（これが必須）
  const notify = await resend.emails.send({
    from: fromHeader,
    to: notifyTo,
    replyTo: data.email,
    subject: `【採用応募】${data.name} 様（${data.desiredJob}）`,
    text: buildText(fields),
    html: buildHtml(fields),
  });

  if (notify.error) {
    console.error("通知メール送信エラー:", notify.error);
    return NextResponse.json(
      { error: "メール送信に失敗しました。時間をおいて再度お試しください。" },
      { status: 502 },
    );
  }

  // 2. 応募者への自動返信メール（失敗してもフォーム送信は成功扱いにする）
  const autoReply = await resend.emails.send({
    from: fromHeader,
    to: data.email,
    replyTo: notifyTo[0],
    subject: AUTO_REPLY_SUBJECT,
    text: autoReplyText(data.name),
    html: autoReplyHtml(data.name),
  });

  if (autoReply.error) {
    console.error("自動返信メール送信エラー:", autoReply.error);
  }

  return NextResponse.json({ ok: true });
}
