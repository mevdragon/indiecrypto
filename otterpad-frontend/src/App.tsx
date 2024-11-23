import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import BuyPanel from "./components/BuyPanel";
import { RainbowKitProvider, getDefaultWallets } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http, useAccount } from "wagmi";
import {
  arbitrum,
  bsc,
  polygon,
  sepolia,
  mainnet,
  base,
  optimism,
} from "wagmi/chains";
import { Alert, ConfigProvider } from "antd";
import "@rainbow-me/rainbowkit/styles.css";
import FundPage from "./pages/FundPage";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CreatePage from "./pages/CreatePage";
import Marquee from "react-fast-marquee";
import TrendingPage from "./pages/TrendingPage";
import TermsOfServicePage from "./pages/TermsOfService";
import AltPayDisclaimerPage from "./pages/AltPayDisclaimerPage";
import { v4 as uuidv4 } from "uuid";

//Import Mixpanel SDK
import mixpanel from "mixpanel-browser";

// Near entry of your product, init Mixpanel
mixpanel.init("264a23c5f42b8da06cb13bd451031459", {
  debug: true,
  track_pageview: true,
  persistence: "localStorage",
});

// Create wagmi config
export const wagmiConfig = createConfig({
  chains: [
    base,
    // bsc,
    // optimism,
    polygon,
    // arbitrum,
    // mainnet,
    sepolia,
  ],
  transports: {
    [sepolia.id]: http(
      "https://sepolia.infura.io/v3/2d52e9fd20f643629739fc0513d6e0b3"
    ),
    [arbitrum.id]: http(
      "https://arbitrum-mainnet.infura.io/v3/2d52e9fd20f643629739fc0513d6e0b3"
    ),
    [polygon.id]: http(
      "https://polygon-mainnet.infura.io/v3/2d52e9fd20f643629739fc0513d6e0b3"
    ),
    [bsc.id]: http(
      "https://bsc-mainnet.infura.io/v3/2d52e9fd20f643629739fc0513d6e0b3"
    ),
    [mainnet.id]: http(
      "https://mainnet.infura.io/v3/2d52e9fd20f643629739fc0513d6e0b3"
    ),
    [base.id]: http(
      "https://base-mainnet.infura.io/v3/2d52e9fd20f643629739fc0513d6e0b3"
    ),
    [optimism.id]: http(
      "https://optimism-mainnet.infura.io/v3/2d52e9fd20f643629739fc0513d6e0b3"
    ),
  },
});

// Create React Query client
const queryClient = new QueryClient();

// Setup RainbowKit
const { wallets } = getDefaultWallets({
  appName: "IndieCrypto",
  projectId: "d8e4503aea07700cf13e5f5179e85283", // Get from WalletConnect
});

const MixPanelTracker = () => {
  const { address: userAddress, isConnected } = useAccount();

  // Mixpanel tracking
  useEffect(() => {
    const uid = userAddress || uuidv4();
    mixpanel.identify(uid);
    mixpanel.people.set({ $name: uid, $wallet: userAddress });
  }, [userAddress]);

  return null;
};

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <ConfigProvider>
            <MixPanelTracker />
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

                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/altpay" element={<AltPayDisclaimerPage />} />
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
