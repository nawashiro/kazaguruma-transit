import { Accessibility } from "lucide-react";
import {
  getWheelchairStatus,
  type OsmElementRef,
  type WheelchairTag,
} from "@/lib/location/wheelchair-status";

export function BarrierDetailBlock({
  wheelchair,
  osmElement,
  relatedPages,
}: {
  wheelchair: WheelchairTag | string | undefined;
  osmElement?: OsmElementRef;
  relatedPages?: Array<{ name: string; url: string }>;
}) {
  const status = getWheelchairStatus(wheelchair, osmElement);
  const borderClassName =
    status.state === "全面"
      ? "border-success"
      : status.state === "一部"
        ? "border-warning"
        : status.state === "非対応"
          ? "border-error"
          : "border-base-300";
  const iconClassName =
    status.state === "全面"
      ? "text-success"
      : status.state === "一部"
        ? "text-warning"
        : status.state === "非対応"
          ? "text-error"
          : "text-base-content";

  return (
    <section
      aria-labelledby="barrier-heading"
      className="ruby-text"
    >
      <h2 id="barrier-heading" className="mb-4 text-xl font-bold">
        バリアフリー情報
      </h2>
      <div
        className={`rounded-box border-l-4 bg-base-200 p-4 ${borderClassName}`}
      >
        <p className="flex items-center gap-2 text-xl font-bold text-base-content">
          <Accessibility aria-hidden="true" className={`size-4 ${iconClassName}`} />
          <span className="text-xl font-bold">{status.label}</span>
        </p>
        <p className="mt-2 text-base text-base-content">{status.description}</p>
        <p className="mt-2 text-base text-base-content">情報源: OpenStreetMap</p>
        <p className="mt-2">
          <a
            href={status.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline h-auto min-h-[44px] flex-col gap-0 py-2 whitespace-normal text-center text-base"
          >
            <span className="text-base">{status.linkLabelMain}</span>
            <span className="text-base">{status.linkLabelSub}</span>
            <span className="sr-only">（新しいタブで開きます）</span>
          </a>
        </p>
        {relatedPages !== undefined && relatedPages.length > 0 && (
          <ul className="mt-2 space-y-2">
            {relatedPages.map((page) => (
              <li key={page.url}>
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link text-base"
                >
                  {page.name}
                  <span className="sr-only">（新しいタブで開きます）</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function BarrierBadge({
  wheelchair,
}: {
  wheelchair: WheelchairTag | string | undefined;
}) {
  const normalized =
    wheelchair === "yes" || wheelchair === "limited" || wheelchair === "no"
      ? wheelchair
      : null;
  if (normalized === null) {
    return null;
  }
  const label =
    normalized === "yes" ? "全面" : normalized === "limited" ? "一部" : "非対応";
  return (
    <span className="badge badge-lg badge-outline text-base">
      <Accessibility aria-hidden="true" className="size-4" />
      <span className="text-base">{label}</span>
    </span>
  );
}
