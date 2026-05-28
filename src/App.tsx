import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import "dayjs/locale/zh-cn";
import { router } from "@/router";
import { theme } from "@/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AntdApp>
          <RouterProvider router={router} />
        </AntdApp>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
