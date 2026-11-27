import { createReadStream } from "node:fs";

type ParserFactory = () => NodeJS.ReadableStream & NodeJS.EventEmitter;

/**
 * osm-pbf-parser は readable-stream 2 系のTransformを返し、Nodeの
 * 非同期イテレーションを持たない。抽出側は async iterable で扱いたいので、
 * data/end/error をキューに溜めて供給する薄いアダプタをここに置く。
 *
 * パーサは読み込み時に .proto を同梱展開するため、索引の更新だけを行う
 * テストからは読み込まないよう、必要になった時点で動的に取り込む。
 */
export async function readOsmItems(
  source: NodeJS.ReadableStream,
): Promise<AsyncIterable<unknown[]>> {
  const imported = (await import("osm-pbf-parser")) as unknown as {
    default: ParserFactory;
  };
  const parser = imported.default();

  const queue: unknown[][] = [];
  let finished = false;
  let failure: Error | null = null;
  let notify: (() => void) | null = null;

  const wake = () => {
    const pending = notify;
    notify = null;
    pending?.();
  };

  parser.on("data", (items: unknown[]) => {
    queue.push(items);
    wake();
  });
  parser.on("end", () => {
    finished = true;
    wake();
  });
  parser.on("error", (error: Error) => {
    failure = error;
    finished = true;
    wake();
  });
  source.on("error", (error: Error) => {
    failure = error;
    finished = true;
    wake();
  });
  source.pipe(parser as unknown as NodeJS.WritableStream);

  async function* iterate(): AsyncGenerator<unknown[]> {
    while (true) {
      if (queue.length > 0) {
        yield queue.shift() as unknown[];
        continue;
      }
      if (failure !== null) {
        throw failure;
      }
      if (finished) {
        return;
      }
      await new Promise<void>((resolve) => {
        notify = resolve;
      });
    }
  }

  return iterate();
}

export async function readOsmPbf(path: string): Promise<AsyncIterable<unknown[]>> {
  return readOsmItems(createReadStream(path));
}
