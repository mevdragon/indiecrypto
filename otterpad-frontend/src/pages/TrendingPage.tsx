import React, { useEffect, useState } from "react";
import { Card, Input, List, Badge, Skeleton, Layout } from "antd";
import { Link } from "react-router-dom";
import AppLayout from "../AppLayout";

const DEFAULT_IMAGE =
  "https://firebasestorage.googleapis.com/v0/b/arbitrage-bot-ea10c.appspot.com/o/generic-sharing%2Fotterpad%2Fotterpad-donut.png?alt=media&token=4738596d-2c90-4911-997b-7fb3dbf00903";

interface OtterpadInfo {
  title: string;
  description: string;
  media: string[];
  website: string;
  twitter: string;
  chain_id_decimals: string;
  contract_address: string;
  otterpad_url: string;
  safety_badge?: boolean;
  priority?: number;
  CreatedAt?: string;
}

const TrendingPage: React.FC = () => {
  const [otterpadList, setOtterpadList] = useState<OtterpadInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    fetchOtterpadList();
  }, []);

  const fetchOtterpadList = async () => {
    try {
      const response = await fetch(
        "https://app.legions.bot/webhook/8208d7eb-32e3-4e84-a69a-b9ecd93f0ffe",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as OtterpadInfo[];

      console.log(data);

      // Separate items with and without priority
      const itemsWithPriority = data.filter((item) => item.priority !== null);
      const itemsWithoutPriority = data.filter(
        (item) => item.priority === null
      );

      // Sort items with priority by priority (lowest first)
      const sortedPriorityItems = itemsWithPriority.sort(
        (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
      );

      // Sort items without priority by CreatedAt (most recent first)
      const sortedNonPriorityItems = itemsWithoutPriority.sort((a, b) => {
        const dateA = a.CreatedAt ? new Date(a.CreatedAt).getTime() : 0;
        const dateB = b.CreatedAt ? new Date(b.CreatedAt).getTime() : 0;
        return dateB - dateA;
      });

      // Combine the sorted arrays: priority items first, then non-priority items
      const sortedData = [...sortedPriorityItems, ...sortedNonPriorityItems];

      setOtterpadList(sortedData);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch Otterpad list:", error);
      setLoading(false);
    }
  };

  const filteredList = otterpadList.filter((item) => {
    const searchLower = searchText.toLowerCase();
    return (
      item.contract_address.toLowerCase().includes(searchLower) ||
      item.title.toLowerCase().includes(searchLower)
    );
  });

  const renderItem = (item: OtterpadInfo) => (
    <List.Item>
      <Link
        to={`/fund/${item.chain_id_decimals}/${item.contract_address}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Badge.Ribbon
          text="Verified"
          color="blue"
          style={{ display: item.safety_badge ? "block" : "none" }}
        >
          <Card
            hoverable
            cover={
              <img
                alt={item.title}
                src={item.media?.[0] || DEFAULT_IMAGE}
                className="h-48 object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = DEFAULT_IMAGE;
                }}
              />
            }
            className="w-full"
          >
            <Card.Meta title={item.title} description={item.description} />
          </Card>
        </Badge.Ribbon>
      </Link>
    </List.Item>
  );

  return (
    <AppLayout>
      <Layout
        style={{
          minHeight: "100%",
          background: "#f5f5f5",
          padding: "16px 16px 16px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
        }}
      >
        <h1 style={{ fontSize: "1.7rem", color: "rgba(0,0,0,0.75)" }}>
          Trending
        </h1>
        <Input.Search
          placeholder="Search by contract address or title..."
          onChange={(e) => setSearchText(e.target.value)}
          className="mb-6 max-w-xl"
          size="large"
          style={{ maxWidth: "600px" }}
        />
        <br />
        <br />
        <Skeleton loading={loading} active>
          <List
            grid={{
              gutter: 16,
              xs: 1,
              sm: 2,
              md: 3,
              lg: 3,
              xl: 4,
              xxl: 4,
            }}
            dataSource={filteredList}
            renderItem={renderItem}
          />
        </Skeleton>
      </Layout>
    </AppLayout>
  );
};

export default TrendingPage;
