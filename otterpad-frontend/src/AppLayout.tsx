import React from "react";
import { UserOutlined } from "@ant-design/icons";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Alert, Space } from "antd";
import Layout, { Content, Header } from "antd/es/layout/layout";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import Marquee from "react-fast-marquee";

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
    <div>
      <Alert
        message={
          <Marquee pauseOnHover gradient={false}>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-around",
              }}
            >
              <span>
                Be careful when buying cryptocurrency! Always do proper due
                diligence.{" "}
                <a href="/help" style={{ padding: "0px 10px" }}>
                  Learn More
                </a>
              </span>
              <span>
                OtterPad is permissionless, which means anyone can fundraise
                from the public internet. Beware of scams{" "}
                <a href="/help" style={{ padding: "0px 10px" }}>
                  Learn More
                </a>
              </span>
            </div>
          </Marquee>
        }
        type="warning"
        banner
        closable={false}
      />
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
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            margin: "64px 10px 32px 10px",
            color: "rgba(0,0,0,0.3)",
            fontWeight: 500,
          }}
        >
          Copyright 2024 Otter Finance | admin@otterpad.cc
        </div>
      </Layout>
    </div>
  );
};

export default AppLayout;
