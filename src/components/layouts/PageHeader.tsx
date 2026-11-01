import type { ReactNode } from "react";
import Breadcrumbs, { type BreadcrumbItem } from "./Breadcrumbs";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

/**
 * ページ先頭の見出しと補足情報を一貫した左揃えで表示する。
 */
export default function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
}: PageHeaderProps) {
  return (
    // ヘッダー自体に.ruby-textを付けると内側のパンくずまでRubyful v2の置換対象になるため、ルビは本文側の要素に付ける
    <header className="my-4 space-y-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} />
      )}
      {eyebrow && <p className="font-semibold ruby-text">{eyebrow}</p>}
      <h1 className="text-3xl font-bold ruby-text">{title}</h1>
      {description && (
        <p className="whitespace-pre-line text-lg ruby-text">{description}</p>
      )}
    </header>
  );
}
