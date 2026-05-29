"use client";

import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import {
  DESIRED_JOBS,
  GENDERS,
  TATTOO_OPTIONS,
  SMOKING_OPTIONS,
  type Submission,
} from "@/lib/form";

type FieldErrors = Partial<Record<keyof Submission, string[]>>;

const initialForm = {
  name: "",
  furigana: "",
  gender: "",
  birthYear: "",
  birthMonth: "",
  birthDay: "",
  postalCode: "",
  address: "",
  phone: "",
  email: "",
  desiredJob: "営業職", // 現在は営業職のみ・初期選択済み
  tattoo: "",
  smoking: "",
  educationSchool: "",
  educationGradYear: "",
  work1Company: "",
  work1Years: "",
  work2Company: "",
  work2Years: "",
  work3Company: "",
  work3Years: "",
  qualifications: "",
  hobby: "",
  motivation: "",
  remarks: "",
};

type FormState = typeof initialForm;

const YEARS = Array.from({ length: 70 }, (_, i) => `${new Date().getFullYear() - 15 - i}`);
const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}`);
const DAYS = Array.from({ length: 31 }, (_, i) => `${i + 1}`);

// 生年月日から満年齢を算出（未入力時は空文字）
function calcAge(year: string, month: string, day: string): string {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) return "";
  const today = new Date();
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return String(age);
}

export default function RecruitForm() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [photo, setPhoto] = useState<string>(""); // data URL
  const [photoName, setPhotoName] = useState<string>("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoError, setPhotoError] = useState<string>("");
  const [compressing, setCompressing] = useState(false);
  const [zipMsg, setZipMsg] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  const autokanaRef = useRef<{ getFurigana: () => string } | null>(null);

  const update = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // お名前入力に連動してふりがなを自動入力（vanilla-autokana）
  useEffect(() => {
    let active = true;
    import("vanilla-autokana")
      .then((AutoKana) => {
        if (!active) return;
        try {
          autokanaRef.current = AutoKana.bind("#applicant-name");
        } catch {
          autokanaRef.current = null;
        }
      })
      .catch(() => {
        autokanaRef.current = null;
      });
    return () => {
      active = false;
    };
  }, []);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    update("name", e.target.value);
    const kana = autokanaRef.current?.getFurigana?.() ?? "";
    if (kana) update("furigana", kana);
  }

  // 郵便番号 → 住所自動入力（zipcloud API）
  async function handlePostalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    update("postalCode", value);
    setZipMsg("");
    const digits = value.replace(/[^0-9]/g, "");
    if (digits.length !== 7) return;
    try {
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`);
      const json = await res.json();
      const r = json?.results?.[0];
      if (r) {
        update("address", `${r.address1}${r.address2}${r.address3}`);
      } else {
        setZipMsg("該当する住所が見つかりませんでした。手入力してください。");
      }
    } catch {
      setZipMsg("住所の自動取得に失敗しました。手入力してください。");
    }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("画像ファイルを選択してください");
      return;
    }
    setCompressing(true);
    try {
      const compressed = await imageCompression(file, {
        maxWidthOrHeight: 1200,
        maxSizeMB: 0.8,
        useWebWorker: true,
      });
      const dataUrl = await imageCompression.getDataUrlFromFile(compressed);
      setPhoto(dataUrl);
      setPhotoName(file.name);
    } catch {
      setPhotoError("画像の処理に失敗しました。別の画像をお試しください");
    } finally {
      setCompressing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setStatus("idle");
    setMessage("");

    if (!photo) {
      setPhotoError("顔写真を添付してください");
      topRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, photo, consent }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrors(json.fieldErrors ?? {});
        setStatus("error");
        setMessage(json.error ?? "送信に失敗しました。");
        topRef.current?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      setStatus("success");
      setMessage("ご応募ありがとうございました。担当者より追ってご連絡いたします。");
      setForm(initialForm);
      setPhoto("");
      setPhotoName("");
      setConsent(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setStatus("error");
      setMessage("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "success") {
    return (
      <div ref={topRef} className="py-10 text-center">
        <h2 className="text-xl font-bold text-slate-900">送信が完了しました</h2>
        <p className="mt-3 text-gray-600">{message}</p>
      </div>
    );
  }

  const age = calcAge(form.birthYear, form.birthMonth, form.birthDay);

  return (
    <div ref={topRef}>
      <header className="mb-8">
        <p className="text-sm text-gray-600">
          以下の項目をご入力のうえ送信してください。
          <span className="text-red-600">※</span> は必須項目です。
        </p>
      </header>

      {status === "error" && (
        <div className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-10" noValidate>
        <Section title="基本情報">
          <Field label="お名前" required error={errors.name}>
            <input
              id="applicant-name"
              type="text"
              value={form.name}
              onChange={handleNameChange}
              className={inputCls}
              autoComplete="name"
            />
          </Field>

          <Field label="ふりがな" required error={errors.furigana}>
            <input
              type="text"
              placeholder="やまだ たろう"
              value={form.furigana}
              onChange={(e) => update("furigana", e.target.value)}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-500">
              お名前の入力に合わせて自動入力されます（必要に応じて修正できます）。
            </p>
          </Field>

          <Field label="顔写真" required error={photoError ? [photoError] : errors.photo}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhoto}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-700"
                />
                <p className="mt-3 text-sm text-gray-500">
                  ※顔写真に関しては、（例）のイラストのようにバストアップでお顔がはっきりわかる写真の添付をお願いいたします。
                </p>
                {compressing && <p className="mt-2 text-sm text-gray-500">画像を処理中…</p>}
                {photo && (
                  <div className="mt-3 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt="顔写真プレビュー"
                      className="h-24 w-24 rounded-md object-cover ring-1 ring-gray-200"
                    />
                    <span className="truncate text-sm text-gray-600">{photoName}</span>
                  </div>
                )}
              </div>

              <figure className="shrink-0">
                <figcaption className="mb-1 text-sm text-gray-700">例）</figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/image1.jpg"
                  alt="顔写真の例"
                  className="w-24 rounded ring-1 ring-gray-200 sm:w-32"
                />
              </figure>
            </div>
          </Field>

          <Field label="性別" required error={errors.gender}>
            <RadioGroup
              name="gender"
              options={GENDERS}
              value={form.gender}
              onChange={(v) => update("gender", v)}
            />
          </Field>

          <Field label="生年月日" required error={errors.birthYear ?? errors.birthMonth ?? errors.birthDay}>
            <div className="flex flex-wrap items-center gap-2">
              <select value={form.birthYear} onChange={(e) => update("birthYear", e.target.value)} className={selectCls}>
                <option value="">年</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span className="text-gray-500">年</span>
              <select value={form.birthMonth} onChange={(e) => update("birthMonth", e.target.value)} className={selectCls}>
                <option value="">月</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="text-gray-500">月</span>
              <select value={form.birthDay} onChange={(e) => update("birthDay", e.target.value)} className={selectCls}>
                <option value="">日</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <span className="text-gray-500">日</span>
            </div>
          </Field>

          <Field label="年齢">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={age}
                className={`${numInputCls} bg-gray-50`}
              />
              <span className="text-gray-500">歳</span>
            </div>
          </Field>

          <Field label="郵便番号" required error={errors.postalCode}>
            <input
              type="text"
              value={form.postalCode}
              onChange={handlePostalChange}
              placeholder="123-4567"
              className={inputCls}
              autoComplete="postal-code"
            />
            <p className="mt-1 text-xs text-gray-500">
              7桁を入力すると住所が自動入力されます。
            </p>
            {zipMsg && <p className="mt-1 text-sm text-amber-600">{zipMsg}</p>}
          </Field>

          <Field label="住所" required error={errors.address}>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="番地・建物名・部屋番号まで入力してください"
              className={inputCls}
              autoComplete="street-address"
            />
          </Field>

          <Field label="電話番号" required error={errors.phone}>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="090-1234-5678"
              className={inputCls}
              autoComplete="tel"
            />
          </Field>

          <Field label="メールアドレス" required error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={inputCls}
              autoComplete="email"
            />
          </Field>

          <Field label="希望職種" required error={errors.desiredJob}>
            <RadioGroup
              name="desiredJob"
              options={DESIRED_JOBS}
              value={form.desiredJob}
              onChange={(v) => update("desiredJob", v)}
            />
          </Field>

          <Field label="入墨・タトゥー" required error={errors.tattoo}>
            <RadioGroup name="tattoo" options={TATTOO_OPTIONS} value={form.tattoo} onChange={(v) => update("tattoo", v)} />
          </Field>

          <Field label="喫煙" required error={errors.smoking}>
            <RadioGroup name="smoking" options={SMOKING_OPTIONS} value={form.smoking} onChange={(v) => update("smoking", v)} />
          </Field>
        </Section>

        <Section title="職務経歴">
          <Field label="最終学歴" required error={errors.educationSchool ?? errors.educationGradYear}>
            <div className="space-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:space-y-0">
              <input
                type="text"
                value={form.educationSchool}
                onChange={(e) => update("educationSchool", e.target.value)}
                placeholder="〇〇高等学校 / 〇〇大学〇〇学部"
                className={`${inputCls} sm:flex-1`}
              />
              <div className="flex items-center justify-end gap-2 sm:justify-start">
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.educationGradYear}
                  onChange={(e) => update("educationGradYear", e.target.value)}
                  placeholder="2024"
                  className={numInputCls}
                />
                <span className="whitespace-nowrap text-gray-500">年卒業</span>
              </div>
            </div>
          </Field>

          <div className="py-5">
            <label className="mb-1 block text-base font-bold text-slate-900">職歴</label>
            <p className="mb-3 text-sm text-red-600">
              これまで務めてきた会社を教えてください（現職の場合は社名横に（在職中）とご入力ください）
            </p>
            <div className="space-y-3">
              {[1, 2, 3].map((n) => {
                const companyKey = `work${n}Company` as keyof FormState;
                const yearsKey = `work${n}Years` as keyof FormState;
                return (
                  <div key={n} className="space-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:space-y-0">
                    <input
                      type="text"
                      value={form[companyKey]}
                      onChange={(e) => update(companyKey, e.target.value)}
                      placeholder="会社名"
                      className={`${inputCls} sm:flex-1`}
                    />
                    <div className="flex items-center justify-end gap-2 sm:justify-start">
                      <span className="whitespace-nowrap text-gray-500">勤続</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form[yearsKey]}
                        onChange={(e) => update(yearsKey, e.target.value)}
                        className={numInputCls}
                      />
                      <span className="text-gray-500">年</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Field label="免許・資格">
            <textarea value={form.qualifications} onChange={(e) => update("qualifications", e.target.value)} rows={3} className={inputCls} />
          </Field>
        </Section>

        <Section title="自己PR">
          <Field label="趣味・特技" required error={errors.hobby}>
            <textarea value={form.hobby} onChange={(e) => update("hobby", e.target.value)} rows={3} className={inputCls} />
          </Field>

          <Field label="志望動機・自己PR" required error={errors.motivation}>
            <textarea value={form.motivation} onChange={(e) => update("motivation", e.target.value)} rows={6} className={inputCls} />
          </Field>

          <Field label="備考">
            <textarea value={form.remarks} onChange={(e) => update("remarks", e.target.value)} rows={3} placeholder="入社時期がある場合はこちらにご記載ください。" className={inputCls} />
          </Field>
        </Section>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-gray-300"
            />
            <span>
              個人情報の取り扱いに同意します。ご入力いただいた情報は採用選考の目的のみに利用します。
              <span className="text-red-600">*</span>
            </span>
          </label>
          {errors.consent && (
            <p className="mt-2 text-sm text-red-600">{errors.consent[0]}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || compressing || !consent}
          className="w-full rounded-full bg-gradient-to-r from-[#6d5be6] via-[#4f7bf0] to-[#33c6e0] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "送信中…" : "上記内容でエントリーする"}
        </button>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";
const selectCls =
  "rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";
const numInputCls =
  "w-24 rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="relative mb-2 border-b-2 border-gray-200 pb-3 text-lg font-bold text-slate-900">
        {title}
        <span className="absolute -bottom-0.5 left-0 h-0.5 w-16 bg-[#0c2747]" />
      </h2>
      <div className="divide-y divide-gray-200">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="py-5">
      <label className="mb-2 block text-base font-bold text-slate-900">
        {label}
        {required && <span className="ml-0.5 text-red-600">※</span>}
      </label>
      {children}
      {error && error.length > 0 && <p className="mt-1 text-sm text-red-600">{error[0]}</p>}
    </div>
  );
}

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {options.map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={(e) => onChange(e.target.value)}
            className="h-4 w-4 border-gray-300"
          />
          {opt}
        </label>
      ))}
    </div>
  );
}
