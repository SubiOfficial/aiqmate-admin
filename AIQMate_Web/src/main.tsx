import { FluentProvider } from "@fluentui/react-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ApiError } from "@/lib/api/client";
import { useMediaQuery } from "@/lib/media";
import { createAppRouter } from "@/router";
import { darkTheme, lightTheme } from "@/theme";
import "./styles.css";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // FR-WEB-022: a 4xx will not get better by asking again.
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      },
    },
  });
}

function App() {
  const [queryClient] = useState(makeQueryClient);
  const [router] = useState(() => createAppRouter(queryClient));
  const dark = useMediaQuery("(prefers-color-scheme: dark)");

  return (
    <FluentProvider theme={dark ? darkTheme : lightTheme}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </FluentProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
