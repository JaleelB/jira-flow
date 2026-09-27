import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncView<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

export function useScreenData<T>(loader: () => Promise<T>, dependencyKey: string) {
  const [state, setState] = useState<{ key: string; view: AsyncView<T> }>({
    key: dependencyKey,
    view: { status: "loading" },
  });
  const [revision, setRevision] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const reload = useCallback(async () => setRevision((value) => value + 1), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key and revision intentionally trigger the ref-backed loader.
  useEffect(() => {
    let active = true;
    setState({ key: dependencyKey, view: { status: "loading" } });
    void loaderRef
      .current()
      .then((data) => {
        if (active) setState({ key: dependencyKey, view: { status: "ready", data } });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            key: dependencyKey,
            view: {
              status: "error",
              message: error instanceof Error ? error.message : String(error),
            },
          });
      });
    return () => {
      active = false;
    };
  }, [dependencyKey, revision]);
  const view: AsyncView<T> = state.key === dependencyKey ? state.view : { status: "loading" };
  return { view, reload };
}
