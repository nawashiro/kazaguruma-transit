import { buildKoFiWidgetUrl } from "@/lib/config/ko-fi-config";
import type { KoFiContent } from "@/types/ko-fi";

interface KoFiSupportProps {
  username: string;
  content: KoFiContent;
}

export default function KoFiSupport({
  username,
  content,
}: KoFiSupportProps) {
  const headingId = "ko-fi-support-heading";

  return (
    <section
      className="card card-border w-full bg-base-100 shadow-sm"
      aria-labelledby={headingId}
    >
      <div className="card-body gap-4 p-4 sm:p-6">
        <h2 id={headingId} className="card-title">
          <span className="ruby-text">{content.heading}</span>
        </h2>
        <p className="ruby-text leading-relaxed">{content.message}</p>
        <iframe
          id="kofiframe"
          src={buildKoFiWidgetUrl(username)}
          className="w-full border-0 bg-[#f9f9f9] p-1"
          height={712}
          title={`${content.heading}（Ko-fi）`}
          loading="lazy"
        />
      </div>
    </section>
  );
}
