import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncView<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

export function useScreenData<T>(loader: () => Promise<T>, dependencyKey: string) {
  const [view, setView] = useState<AsyncView<T>>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const reload = useCallback(async () => setRevision((value) => value + 1), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key and revision intentionally trigger the ref-backed loader.
  useEffect(() => {
    let active = true;
    setView({ status: "loading" });
    void loaderRef
      .current()
      .then((data) => {
        if (active) setView({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (active)
          setView({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
      });
    return () => {
      active = false;
    };
  }, [dependencyKey, revision]);
  return { view, reload };
}
