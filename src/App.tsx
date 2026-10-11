import { lazy, Suspense, useEffect, useState } from "react";
import { Website } from "./site/Website";
const Editor = lazy(() =>
  import("./editor/Editor").then((m) => ({ default: m.Editor })),
);
export function App() {
  const [route, setRoute] = useState(location.hash);
  useEffect(() => {
    const change = () => setRoute(location.hash);
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return route.startsWith("#editor") ? (
    <Suspense
      fallback={
        <div className="loading-studio">
          <span className="status-dot" /> Opening your workshop…
        </div>
      }
    >
      <Editor />
    </Suspense>
  ) : (
    <Website />
  );
}
