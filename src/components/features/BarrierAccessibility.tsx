import { Accessibility } from "lucide-react";
import {
  getWheelchairStatus,
  type OsmElementRef,
  type WheelchairState,
  type WheelchairTag,
} from "@/lib/location/wheelchair-status";

function WheelchairStatusBadge({ state }: { state: WheelchairState }) {
  return (
    <span
      className={`badge badge-lg text-xl font-bold ${
        state === "全面"
          ? "badge-success"
          : state === "一部"
            ? "badge-warning"
            : state === "非対応"
              ? "badge-error"
              : "badge-neutral"
      }`}
    >
      <Accessibility aria-hidden="true" className="size-6" />
      <span className="sr-only">車いす</span>
      <span className="text-xl">{state}</span>
    </span>
  );
}

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

  return (
    <section aria-labelledby="barrier-heading" className="ruby-text">
      <h2 id="barrier-heading" className="mb-4 text-xl font-bold">
        バリアフリー情報
      </h2>
      <WheelchairStatusBadge state={status.state} />
      <p className="mt-2 text-base text-base-content">{status.description}</p>
      <p className="mt-2">
        <a
          href={status.referenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary h-auto min-h-[44px] gap-0 rounded-full px-4 py-2 whitespace-normal text-base dark:rounded-sm"
        >
          <span className="text-base">
            {status.linkLabelMain}
            {status.linkLabelSub}
          </span>
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
    </section>
  );
}

export function BarrierBadge({
  wheelchair,
}: {
  wheelchair: WheelchairTag | string | undefined;
}) {
  const state: WheelchairState | null =
    wheelchair === "yes"
      ? "全面"
      : wheelchair === "limited"
        ? "一部"
        : wheelchair === "no"
          ? "非対応"
          : null;
  if (state === null) {
    return null;
  }
  return <WheelchairStatusBadge state={state} />;
}
