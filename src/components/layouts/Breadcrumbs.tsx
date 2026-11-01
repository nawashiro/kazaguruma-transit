import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    // Rubyful v2は.ruby-text要素のテキストを辞書セグメント単位のrubyへ置換するため、パンくずのラベルはこのクラスを付けない
    <nav
      aria-label="パンくずリスト"
      className="breadcrumbs text-base"
    >
      <ul>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {isCurrent || item.href === undefined ? (
                <span aria-current={isCurrent ? "page" : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href}>{item.label}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
