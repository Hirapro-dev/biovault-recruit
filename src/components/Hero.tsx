import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative mx-auto h-[280px] w-full max-w-[1020px] overflow-hidden rounded-b-3xl sm:h-[440px]">
      <Image
        src="/header-bg.png"
        alt=""
        fill
        priority
        sizes="(max-width: 1020px) 100vw, 1020px"
        className="object-cover"
      />

      {/* ロゴの視認性を確保する上部グラデーション */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />

      {/* 左上ロゴ */}
      <div className="absolute left-5 top-5 z-10 sm:left-8 sm:top-7">
        <Image
          src="/logo_white.png"
          alt="MRT inc."
          width={1901}
          height={490}
          priority
          className="h-7 w-auto sm:h-9"
        />
      </div>
    </section>
  );
}
