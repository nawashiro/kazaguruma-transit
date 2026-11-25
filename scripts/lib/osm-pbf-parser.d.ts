declare module "osm-pbf-parser" {
  import type { Transform } from "node:stream";

  interface OsmPbfParserFactory {
    (): Transform;
  }

  const factory: OsmPbfParserFactory;
  export default factory;
}
