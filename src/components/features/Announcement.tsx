import { Info } from "lucide-react";
import { appConfig } from "@/lib/config/app-config";

export default function Announcement() {
  const headingId = "announcement-heading";

  return (
    <section
      className="card card-border w-full bg-base-100 shadow-sm"
      aria-labelledby={headingId}
    >
      <div className="card-body gap-4 p-4 sm:p-6">
        <h2 id={headingId} className="card-title inline gap-0">
          <Info
            className="mr-1 h-6 w-6 shrink-0 text-info inline-block"
            aria-hidden="true"
          />
          <span className="ruby-text">運営からのお知らせ</span>
        </h2>
        <a className="link w-fit ruby-text" href={appConfig.announcement.url}>
          {appConfig.announcement.information}
        </a>
      </div>
    </section>
  );
}
