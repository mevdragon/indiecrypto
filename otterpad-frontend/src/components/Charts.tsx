import { ApexOptions } from "apexcharts";
import { Address } from "viem";
import ReactApexCharts from "react-apexcharts";
import dayjs from "dayjs";
import { ContractDataResult } from "../pages/FundPage";
import {
  Button,
  Carousel,
  Space,
  Tabs,
  Image,
  Typography,
  CarouselProps,
} from "antd";
import TabPane from "antd/es/tabs/TabPane";
import {
  AreaChartOutlined,
  GlobalOutlined,
  LineChartOutlined,
  ShoppingCartOutlined,
  TwitterOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";

const { Title, Paragraph } = Typography;

const generateBullishData = () => {
  const basePrice = 6000;
  const data = [];
  const startTime = new Date("2024-01-01").getTime();

  for (let i = 0; i < 50; i++) {
    const time = startTime + i * 1800000; // 30-minute intervals
    const volatility = Math.random() * 25;
    const trend = i * 1.8; // Slightly stronger upward trend

    // Reduced probability of red candles (25%)
    const shouldBeRed = Math.random() < 0.27;

    let open, close;
    if (shouldBeRed) {
      open = basePrice + trend + Math.random() * 20;
      close = open - Math.random() * 12; // Smaller red candles
    } else {
      open = basePrice + trend + Math.random() * 20;
      close = open + Math.random() * 25; // Green candle (close higher than open)
    }

    const high = Math.max(open, close) + volatility;
    const low = Math.min(open, close) - volatility;

    data.push({
      x: new Date(time),
      y: [open, high, low, close],
    });
  }
  return data;
};

const carouselSettings: CarouselProps = {
  autoplay: true,
  dots: true,
  effect: "fade",
};

export interface OtterpadInfo {
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

const Charts = ({
  address,
  contractData,
}: {
  address: Address;
  contractData: ContractDataResult | null;
}) => {
  console.log(address);
  console.log(contractData);

  const [otterpadInfo, setOtterpadInfo] = useState<OtterpadInfo | null>(null);

  const chartData = {
    series: [
      {
        name: "candle",
        data: generateBullishData(),
      },
    ],
    options: {
      chart: {
        height: 350,
        type: "candlestick",
        id: "candlestick-fundraiser",
      },
      title: {
        text: `TVL - ${contractData?.title}`,
        align: "left",
      },
      annotations: {
        xaxis: [
          {
            x: "Oct 06 14:00",
            borderColor: "#00E396",
            label: {
              borderColor: "#00E396",
              style: {
                fontSize: "12px",
                color: "#fff",
                background: "#00E396",
              },
              orientation: "horizontal",
              offsetY: 7,
              text: "Annotation Test",
            },
          },
        ],
      },
      tooltip: {
        enabled: true,
      },
      xaxis: {
        type: "datetime",
        labels: {
          formatter: function (val: any) {
            return dayjs(val).format("MMM DD HH:mm");
          },
        },
      },
      yaxis: {
        tooltip: {
          enabled: true,
        },
      },
    } as ApexOptions,
  };

  async function fetchOtterpadInfo(
    address: Address
  ): Promise<OtterpadInfo | undefined> {
    const url = contractData?.richInfoUrl;
    // const url = `https://api.legions.bot/api/w/officex/capture_u/f/officex/otterpad_rest_api?fund=${"a837fc4a-fdf2-4646-b682-68439ea59e0d"}"`;
    console.log(url);
    console.log(address);
    if (!url) return;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as OtterpadInfo;
      console.log("metadata", data);
      setOtterpadInfo(data);
      return data;
    } catch (error) {
      throw new Error(
        `Failed to fetch Otterpad info: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  useEffect(() => {
    fetchOtterpadInfo(address);
  }, [address, contractData?.richInfoUrl]);

  return (
    <div
      id="chart"
      style={{
        flex: 1,
        maxHeight: "100vh",
        textAlign: "left",
        minHeight: "80vh",
        width: "100%",
      }}
    >
      <Tabs
        defaultActiveKey="tvl"
        style={{
          background: "white",
          borderRadius: "8px",
          height: "80vh",
          padding: "16px",
          overflowY: "scroll",
        }}
      >
        <TabPane
          tab={
            <span>
              <ShoppingCartOutlined />
              About
            </span>
          }
          key="about"
          style={{ height: "100%", minHeight: "100%" }}
        >
          {otterpadInfo ? (
            <div style={{ padding: "0px" }}>
              <Space
                direction="vertical"
                size="large"
                style={{ width: "100%" }}
              >
                {/* Title and Description Section */}
                <div>
                  <Title level={2} style={{ marginBottom: "16px" }}>
                    {otterpadInfo.title}
                  </Title>
                  <Paragraph style={{ fontSize: "16px" }}>
                    {otterpadInfo.description}
                  </Paragraph>
                </div>

                {/* Social Links Section */}
                <Space size="middle">
                  {otterpadInfo.website && (
                    <Button
                      icon={<GlobalOutlined />}
                      type="default"
                      onClick={() =>
                        window.open(otterpadInfo.website, "_blank")
                      }
                    >
                      Website
                    </Button>
                  )}
                  {otterpadInfo.twitter && (
                    <Button
                      icon={<TwitterOutlined />}
                      type="default"
                      onClick={() =>
                        window.open(`${otterpadInfo.twitter}`, "_blank")
                      }
                    >
                      Twitter
                    </Button>
                  )}
                </Space>

                {/* Media Carousel Section */}
                {otterpadInfo.media.length > 0 && (
                  <div
                    style={{
                      minWidth: "400px",
                      maxWidth: "45vw",
                      width: "100%",
                      margin: "0 auto",
                      backgroundColor: "#f5f5f5",
                      borderRadius: "8px",
                      padding: "16px",
                    }}
                  >
                    <Carousel {...carouselSettings}>
                      {otterpadInfo.media.map((url, index) => (
                        <div key={index}>
                          <div
                            style={{
                              height: "400px",
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Image
                              src={url}
                              alt={`${otterpadInfo.title} media ${index + 1}`}
                              style={{
                                maxHeight: "100%",
                                objectFit: "contain",
                              }}
                              preview={true}
                            />
                          </div>
                        </div>
                      ))}
                    </Carousel>
                  </div>
                )}
              </Space>
            </div>
          ) : (
            <p>Loading...</p>
          )}
        </TabPane>
        <TabPane
          tab={
            <span>
              <AreaChartOutlined />
              TVL
            </span>
          }
          key="tvl"
          style={{ height: "100%", minHeight: "100%" }}
        >
          <div style={{ height: "100%", width: "100%", minHeight: "100%" }}>
            <ReactApexCharts
              series={chartData.series}
              type="candlestick"
              height="550px"
              options={chartData.options}
            />
          </div>
        </TabPane>
        <TabPane
          tab={
            <span>
              <LineChartOutlined />
              Price
            </span>
          }
          key="price"
          style={{ height: "100%", minHeight: "100%" }}
        >
          <div style={{ height: "100%", width: "100%", minHeight: "100%" }}>
            <ReactApexCharts
              series={chartData.series}
              type="candlestick"
              height="550px"
              options={chartData.options}
            />
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Charts;
