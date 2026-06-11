import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { dayjsConfig } from "./dayjsConfig";
import "./index.css";
import { routeTree } from "./routeTree.gen";

dayjsConfig.executeDayJsPlugins();

const queryClient = new QueryClient();
const history =
  window.location.protocol === "file:" ? createHashHistory() : undefined;

// Set up a Router instance
const router = createRouter({
  routeTree,
  ...(history ? { history } : {}),
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  // Since we're using React Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

// Register things for type-safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
