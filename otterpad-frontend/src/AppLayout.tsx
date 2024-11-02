import React from "react";
import { UserOutlined } from "@ant-design/icons";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Space } from "antd";
import Layout, { Content, Header } from "antd/es/layout/layout";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";

// Topbar component
const Topbar = ({ children }: { children: React.ReactNode }) => (
  <Header
    style={{
      backgroundColor: "#f5f5f5",
      display: "flex",
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 16px",
    }}
  >
    {children}
  </Header>
);

// Layout component
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { address: userAddress, isConnected } = useAccount();
  const isDesktop = window.innerWidth >= 1024; // You can also use your useMediaQuery hook here

  const WalletConnector = () => (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-end",
      }}
    >
      <ConnectButton />
    </div>
  );

  const NavigationLinks = () => (
    <Space
      size="large"
      style={{
        display: isDesktop ? "flex" : "none",
      }}
    >
      <Link to="/trending" style={{ color: "#666" }}>
        Trending
      </Link>
      <Link to="/create" style={{ color: "#666" }}>
        Create
      </Link>
      <Link
        onClick={(e) => e.preventDefault()}
        to="/help"
        style={{ color: "#666", cursor: "not-allowed" }}
      >
        Help
      </Link>
    </Space>
  );

  const MobileNavigationLinks = () => (
    <Link
      to="/create"
      style={{
        color: "#666",
        display: isDesktop ? "none" : "block",
      }}
    >
      Create
    </Link>
  );

  return (
    <Layout style={{ backgroundColor: "#f5f5f5", width: "100vw" }}>
      <Topbar>
        <h1 style={{ margin: 0 }}>
          <Link
            to="/trending"
            style={{
              fontSize: isDesktop ? "1.5rem" : "1.2rem",
              fontWeight: "bold",
              display: "flex",
            }}
          >
            Otterpad.cc
          </Link>
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <NavigationLinks />
          <MobileNavigationLinks />
          <WalletConnector />
        </div>
      </Topbar>
      <Content>{children}</Content>
    </Layout>
  );
};

export default AppLayout;
