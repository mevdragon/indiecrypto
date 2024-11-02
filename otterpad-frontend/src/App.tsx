import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import BuyPanel from "./components/BuyPanel";
import { RainbowKitProvider, getDefaultWallets } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { ConfigProvider } from "antd";
import "@rainbow-me/rainbowkit/styles.css";
import FundPage from "./pages/FundPage";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CreatePage from "./pages/CreatePage";
import TrendingPage from "./pages/TrendingPage";

// Create wagmi config
const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});

// Create React Query client
const queryClient = new QueryClient();

// Setup RainbowKit
const { wallets } = getDefaultWallets({
  appName: "OtterPad Fundraiser",
  projectId: "YOUR_PROJECT_ID", // Get from WalletConnect
});

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ConfigProvider>
            <BrowserRouter>
              <Routes>
                {/* Redirect root to trending */}
                <Route path="/" element={<Navigate to="/trending" replace />} />

                {/* Redirect /fund to trending */}
                <Route
                  path="/fund"
                  element={<Navigate to="/trending" replace />}
                />

                {/* Main routes */}
                <Route path="/trending" element={<TrendingPage />} />
                <Route path="/create" element={<CreatePage />} />

                {/* Fundraiser routes with dynamic parameter */}
                <Route
                  path="/fund/:chainIdDecimal/:contractAddress"
                  element={<FundPage />}
                />

                {/* Catch all route - optional */}
                <Route path="*" element={<Navigate to="/trending" replace />} />
              </Routes>
            </BrowserRouter>
          </ConfigProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
