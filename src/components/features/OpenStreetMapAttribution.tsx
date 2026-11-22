export function OpenStreetMapAttribution() {
  return (
    <p className="mt-2 text-base">
      ©{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="link"
      >
        OpenStreetMap contributors
        <span className="sr-only">（新しいタブで開きます）</span>
      </a>{" "}
      ODbL-1.0
    </p>
  );
}
