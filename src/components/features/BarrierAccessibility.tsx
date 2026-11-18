import { Accessibility } from "lucide-react";
import { OpenStreetMapAttribution } from "@/components/features/OpenStreetMapAttribution";
import {
  getWheelchairStatus,
  type OsmElementRef,
  type WheelchairState,
  type WheelchairTag,
} from "@/lib/location/wheelchair-status";

function WheelchairStatusBadge({ state }: { state: WheelchairState }) {
  return (
    <span
      className={`badge badge-lg text-xl font-bold whitespace-nowrap ${
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

export function WheelchairInfoBlock({
  wheelchair,
  osmElement,
}: {
  wheelchair: WheelchairTag | string | undefined;
  osmElement?: OsmElementRef;
}) {
  const status = getWheelchairStatus(wheelchair, osmElement);

  return (
    <section aria-labelledby="wheelchair-heading">
      <h2 id="wheelchair-heading" className="mb-4 text-xl font-bold ruby-text">
        車いす情報
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <WheelchairStatusBadge state={status.state} />
        <p className="text-base ruby-text">{status.description}</p>
      </div>
      <OpenStreetMapAttribution />
      <p className="mt-2">
        <a
          href={status.referenceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary h-auto min-h-[44px] gap-0 rounded-full px-4 whitespace-normal text-base dark:rounded-sm"
        >
          <span className="text-base">
            {status.linkLabelMain}
            {status.linkLabelSub}
          </span>
          <span className="sr-only">（新しいタブで開きます）</span>
        </a>
      </p>
    </section>
  );
}

export function BarrierInfoBlock({
  relatedPages,
}: {
  relatedPages?: Array<{ name: string; url: string }>;
}) {
  if (relatedPages === undefined || relatedPages.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="barrier-heading">
      <h2 id="barrier-heading" className="mb-4 text-xl font-bold ruby-text">
        バリアフリー情報
      </h2>
      <ul className="space-y-2">
        {relatedPages.map((page) => (
          <li key={page.url}>
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="link text-base"
            >
              <span className="ruby-text">{page.name}</span>
              <span className="sr-only">（新しいタブで開きます）</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
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
  return (
    <>
      <WheelchairInfoBlock wheelchair={wheelchair} osmElement={osmElement} />
      <BarrierInfoBlock relatedPages={relatedPages} />
    </>
  );
}

export function BarrierBadge({
  wheelchair,
}: {
  wheelchair: WheelchairTag | string | undefined;
}) {
  const state: WheelchairState =
    wheelchair === "yes"
      ? "全面"
      : wheelchair === "limited"
        ? "一部"
        : wheelchair === "no"
          ? "非対応"
          : "情報なし";
  return <WheelchairStatusBadge state={state} />;
}
