import { z } from "zod";

// 希望職種（現在は営業職のみ。増やす場合はここに追加）
export const DESIRED_JOBS = ["営業職"] as const;

export const GENDERS = ["男性", "女性"] as const;

export const TATTOO_OPTIONS = ["無", "有"] as const;

export const SMOKING_OPTIONS = ["喫煙しない", "喫煙する"] as const;

// 顔写真: ブラウザ側でリサイズ後に data URL(base64) で送信する想定。
// リサイズ後でも念のためサーバー側で上限チェック（base64 文字列長で約3MBまで）。
const MAX_PHOTO_BASE64_LENGTH = 3 * 1024 * 1024;

const requiredString = (label: string) =>
  z.string().trim().min(1, { message: `${label}を入力してください` });

const optionalString = (max: number) =>
  z.string().trim().max(max).optional().default("");

export const submissionSchema = z.object({
  // 基本情報
  name: requiredString("お名前").max(100),
  furigana: requiredString("ふりがな").max(200),
  gender: z.enum(GENDERS, { message: "性別を選択してください" }),
  birthYear: requiredString("生年(年)").max(4),
  birthMonth: requiredString("生月(月)").max(2),
  birthDay: requiredString("生日(日)").max(2),
  postalCode: requiredString("郵便番号").max(8),
  address: requiredString("住所").max(200),
  phone: requiredString("電話番号").max(20),
  email: z.email({ message: "正しいメールアドレスを入力してください" }).max(200),
  desiredJob: z.enum(DESIRED_JOBS, { message: "希望職種を選択してください" }),
  tattoo: z.enum(TATTOO_OPTIONS, { message: "入墨・タトゥーの有無を選択してください" }),
  smoking: z.enum(SMOKING_OPTIONS, { message: "喫煙の有無を選択してください" }),

  // 職務経歴
  educationSchool: requiredString("最終学歴").max(200),
  educationGradYear: requiredString("卒業年").max(4),
  work1Company: optionalString(200),
  work1Years: optionalString(3),
  work2Company: optionalString(200),
  work2Years: optionalString(3),
  work3Company: optionalString(200),
  work3Years: optionalString(3),
  qualifications: optionalString(500),

  // 自己PR
  hobby: requiredString("趣味・特技").max(300),
  motivation: requiredString("志望動機・自己PR").max(2000),
  remarks: optionalString(2000),

  // 顔写真（data URL）
  photo: z
    .string()
    .min(1, { message: "顔写真を添付してください" })
    .max(MAX_PHOTO_BASE64_LENGTH, {
      message: "顔写真のサイズが大きすぎます。別の画像をお試しください",
    })
    .refine((v) => v.startsWith("data:image/"), {
      message: "顔写真は画像ファイルを添付してください",
    }),

  // 個人情報の取り扱い同意
  consent: z.literal(true, {
    message: "個人情報の取り扱いに同意してください",
  }),
});

export type Submission = z.infer<typeof submissionSchema>;
