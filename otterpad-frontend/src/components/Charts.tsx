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
  Spin,
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
import { useBlockNumber, usePublicClient } from "wagmi";

const { Title, Paragraph } = Typography;

const formatWithDecimals = (value: number, decimals: number = 18) => {
  const divisor = Math.pow(10, decimals);
  return Number((value / divisor).toFixed(2));
};

const formatPrice = (value: bigint, decimals: number = 18) => {
  const divisor = Math.pow(10, decimals);
  return Number((Number(value) / divisor).toFixed(4));
};

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

interface ChartData {
  series: { name: string; data: any[] }[];
  options: any;
}

const Charts = ({
  address,
  contractData,
}: {
  address: Address;
  contractData: ContractDataResult | null;
}) => {
  const [otterpadInfo, setOtterpadInfo] = useState<OtterpadInfo | null>(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const publicClient = usePublicClient();
  const isDesktop = window.innerWidth >= 1024; // You can also use your useMediaQuery hook here
  const { data: currentBlock } = useBlockNumber();
  const [chartData, setChartData] = useState<{
    tvl: ChartData;
    price: ChartData;
  }>({
    tvl: {
      series: [
        {
          name: "TVL",
          data: [],
        },
      ],
      options: {
        chart: {
          type: "area",
          height: 550,
          zoom: {
            enabled: false,
          },
        },
        dataLabels: {
          enabled: false,
        },
        stroke: {
          curve: "straight",
        },

        title: {
          text: "Total Value Locked (DEX Liquidity)",
          align: "left",
        },
        labels: [],
        xaxis: {
          type: "datetime",
          labels: {
            datetimeFormatter: {
              year: "yyyy",
              month: "MMM 'yy",
              day: "dd MMM",
              hour: "HH:mm",
            },
            formatter: (val: any) => dayjs(val).format("MMM DD HH:mm"),
          },
        },
        yaxis: {
          opposite: true,
          labels: { formatter: (val: any) => val.toFixed(4) },
        },
        tooltip: {
          x: { formatter: (val: any) => dayjs(val).format("MMM DD HH:mm:ss") },
        },
      },
    },
    price: {
      series: [{ name: "Price", data: [] }],
      options: {
        chart: {
          type: "candlestick",
          height: 550,
          animations: { enabled: false },
          toolbar: {
            show: true,
            tools: {
              download: true,
              selection: true,
              zoom: true,
              zoomin: true,
              zoomout: true,
              pan: true,
            },
          },
        },
        title: { text: "Price History", align: "left" },
        xaxis: {
          type: "datetime",
          labels: {
            datetimeFormatter: {
              year: "yyyy",
              month: "MMM 'yy",
              day: "dd MMM",
              hour: "HH:mm",
            },
            formatter: (val: any) => dayjs(val).format("MMM DD HH:mm"),
          },
        },
        yaxis: {
          tooltip: { enabled: true },
          labels: { formatter: (val: any) => val.toFixed(4) },
        },
        plotOptions: {
          candlestick: {
            colors: { upward: "#26C281", downward: "#ed3419" },
          },
        },
        tooltip: {
          x: { formatter: (val: any) => dayjs(val).format("MMM DD HH:mm:ss") },
        },
      },
    },
  });

  useEffect(() => {
    const fetchAndProcessData = async () => {
      if (!currentBlock || !address || !publicClient || !contractData) return;

      setIsFetchingHistory(true);

      const blocksPerDay = (24 * 60 * 60) / 12;
      const startBlock = currentBlock - BigInt(Math.floor(blocksPerDay * 7));

      try {
        // Get payment token decimals
        const paymentTokenContract = {
          address: contractData.paymentTokenAddress,
          abi: [
            {
              inputs: [],
              name: "decimals",
              outputs: [{ type: "uint8", name: "" }],
              stateMutability: "view",
              type: "function",
            },
          ],
        };

        const decimals = await publicClient.readContract({
          ...paymentTokenContract,
          functionName: "decimals",
        });

        // Fetch events
        const [purchaseEvents, refundEvents] = await Promise.all([
          publicClient.getLogs({
            address,
            event: {
              type: "event",
              name: "TokensPurchased",
              inputs: [
                { type: "address", name: "purchaser", indexed: true },
                { type: "uint256", name: "paymentAmount" },
                { type: "uint256", name: "contributionAmount" },
                { type: "uint256", name: "tokenAmount" },
                { type: "uint256", name: "orderIndex", indexed: true },
                { type: "uint256", name: "netActiveContributions" },
                { type: "uint256", name: "timestamp" },
              ],
            },
            fromBlock: startBlock,
            toBlock: currentBlock,
          }),
          publicClient.getLogs({
            address,
            event: {
              type: "event",
              name: "Refunded",
              inputs: [
                { type: "address", name: "purchaser", indexed: true },
                { type: "uint256", name: "contributionAmount" },
                { type: "uint256", name: "orderIndex", indexed: true },
                { type: "uint256", name: "netActiveContributions" },
                { type: "uint256", name: "timestamp" },
              ],
            },
            fromBlock: startBlock,
            toBlock: currentBlock,
          }),
        ]);

        // Process events
        const allEvents = [
          ...purchaseEvents.map((e) => ({
            timestamp: Number(e.args.timestamp),
            amount: formatWithDecimals(
              Number(e.args.contributionAmount),
              Number(decimals)
            ),
            netActiveContributions: formatWithDecimals(
              Number(e.args.netActiveContributions),
              Number(decimals)
            ),
            type: "purchase",
          })),
          ...refundEvents.map((e) => ({
            timestamp: Number(e.args.timestamp),
            amount: formatWithDecimals(
              Number(e.args.contributionAmount),
              Number(decimals)
            ),
            netActiveContributions: formatWithDecimals(
              Number(e.args.netActiveContributions),
              Number(decimals)
            ),
            type: "refund",
          })),
        ].sort((a, b) => a.timestamp - b.timestamp);

        if (allEvents.length === 0) {
          console.log("No events found");
          return;
        }

        // Process minute intervals
        const minuteData = new Map();
        const firstTimestamp = allEvents[0].timestamp;
        const lastTimestamp = allEvents[allEvents.length - 1].timestamp;
        const startMinute = Math.floor(firstTimestamp / 60) * 60;
        const endMinute = Math.ceil(lastTimestamp / 60) * 60;
        let lowestTVL = allEvents[0].netActiveContributions;
        let highestTVL = allEvents[0].netActiveContributions;
        let currentTVL = allEvents[0].netActiveContributions;

        // Initialize first interval
        minuteData.set(startMinute, {
          open: allEvents[0].netActiveContributions,
          high: allEvents[0].netActiveContributions,
          low: allEvents[0].netActiveContributions,
          close: allEvents[0].netActiveContributions,
          timestamp: startMinute * 1000,
        });

        // Process each minute interval
        for (
          let timestamp = startMinute;
          timestamp <= endMinute;
          timestamp += 60
        ) {
          const eventsInMinute = allEvents.filter(
            (e) => Math.floor(e.timestamp / 60) * 60 === timestamp
          );

          const prevMinute = minuteData.get(timestamp - 60);
          const prevClose = prevMinute ? prevMinute.close : currentTVL;

          if (eventsInMinute.length > 0) {
            const lastEvent = eventsInMinute[eventsInMinute.length - 1];
            currentTVL = lastEvent.netActiveContributions;

            const high = Math.max(
              ...eventsInMinute.map((e) => e.netActiveContributions)
            );
            const low = Math.min(
              ...eventsInMinute.map((e) => e.netActiveContributions)
            );
            lowestTVL = Math.min(lowestTVL, low);

            minuteData.set(timestamp, {
              open: prevClose,
              high,
              low,
              close: currentTVL,
              timestamp: timestamp * 1000,
            });
          } else {
            minuteData.set(timestamp, {
              open: prevClose,
              high: prevClose,
              low: prevClose,
              close: prevClose,
              timestamp: timestamp * 1000,
            });
          }
        }

        // Calculate price data based on TVL
        const calculatePrice = (tvl: number) => {
          if (
            !contractData.startPrice ||
            !contractData.endPrice ||
            !contractData.targetLiquidity
          )
            return 0;

          const startPrice = formatPrice(contractData.startPrice);
          const endPrice = formatPrice(contractData.endPrice);
          const targetLiquidity = formatPrice(contractData.targetLiquidity);

          if (tvl >= targetLiquidity) {
            return endPrice;
          }

          return startPrice + ((endPrice - startPrice) * tvl) / targetLiquidity;
        };

        const tvlData = Array.from(minuteData.values()).map((minute) => ({
          date: new Date(minute.timestamp).toISOString(),
          tvl: minute.close,
        }));

        // Convert to candlestick format
        const candlesticks = Array.from(minuteData.values()).map((minute) => ({
          x: new Date(minute.timestamp),
          y: [minute.open, minute.high, minute.low, minute.close].map((val) =>
            Number(val.toFixed(2))
          ),
        }));
        const priceData = candlesticks.map((tvlCandle) => ({
          x: tvlCandle.x,
          y: tvlCandle.y.map((tvl) => Number(calculatePrice(tvl).toFixed(4))),
        }));

        // Initialize first interval
        minuteData.set(startMinute, {
          open: allEvents[0].netActiveContributions,
          high: allEvents[0].netActiveContributions,
          low: allEvents[0].netActiveContributions,
          close: allEvents[0].netActiveContributions,
          timestamp: startMinute * 1000,
        });

        // Process each minute interval
        for (
          let timestamp = startMinute;
          timestamp <= endMinute;
          timestamp += 60
        ) {
          const eventsInMinute = allEvents.filter(
            (e) => Math.floor(e.timestamp / 60) * 60 === timestamp
          );

          const prevMinute = minuteData.get(timestamp - 60);
          const prevClose = prevMinute ? prevMinute.close : currentTVL;

          if (eventsInMinute.length > 0) {
            const lastEvent = eventsInMinute[eventsInMinute.length - 1];
            currentTVL = lastEvent.netActiveContributions;

            const high = Math.max(
              ...eventsInMinute.map((e) => e.netActiveContributions)
            );
            const low = Math.min(
              ...eventsInMinute.map((e) => e.netActiveContributions)
            );

            lowestTVL = Math.min(lowestTVL, low);
            highestTVL = Math.max(highestTVL, high);

            minuteData.set(timestamp, {
              open: prevClose,
              high,
              low,
              close: currentTVL,
              timestamp: timestamp * 1000,
            });
          } else {
            minuteData.set(timestamp, {
              open: prevClose,
              high: prevClose,
              low: prevClose,
              close: prevClose,
              timestamp: timestamp * 1000,
            });
          }
        }
        console.log(`tvlData`, tvlData);
        // Update both charts simultaneously
        setChartData((prev) => ({
          tvl: {
            series: [{ name: "TVL", data: tvlData.map((d) => d.tvl) }],
            options: {
              chart: {
                type: "area",
                height: 550,
                zoom: {
                  enabled: false,
                },
              },
              dataLabels: {
                enabled: false,
              },
              stroke: {
                curve: "straight",
              },

              title: {
                text: "Total Value Locked (DEX Liquidity)",
                align: "left",
              },
              labels: tvlData.map((d) => d.date),
              xaxis: {
                type: "datetime",
              },
              yaxis: {
                opposite: true,
              },
              legend: {
                horizontalAlign: "left",
              },
            },
          },
          price: {
            ...prev.price,
            series: [{ name: "Price", data: priceData }],
            options: {
              ...prev.price.options,
              xaxis: {
                ...prev.price.options.xaxis,
                min: firstTimestamp * 1000,
                max: lastTimestamp * 1000,
              },
            },
          },
        }));
        setIsFetchingHistory(false);
      } catch (error) {
        console.error("Error fetching and processing data:", error);
        setIsFetchingHistory(false);
      }
    };

    fetchAndProcessData();
  }, [address, currentBlock, publicClient, contractData]);

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
        defaultActiveKey="price"
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
              <LineChartOutlined />
              Price
            </span>
          }
          key="price"
          style={{ height: "100%", minHeight: "100%" }}
        >
          {isFetchingHistory && (
            <div
              style={{
                textAlign: "center",
                margin: "0px 10px",
                position: "absolute",
                left: isDesktop ? "100px" : "50vw",
              }}
            >
              <Spin />
            </div>
          )}
          <div style={{ height: "100%", width: "100%", minHeight: "100%" }}>
            <ReactApexCharts
              series={chartData.price.series}
              type="candlestick"
              height="550px"
              options={chartData.price.options}
            />
          </div>
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
          {isFetchingHistory && (
            <div
              style={{
                textAlign: "center",
                margin: "0px 10px",
                position: "absolute",
                left: isDesktop ? "250px" : "50vw",
              }}
            >
              <Spin />
            </div>
          )}
          <div style={{ height: "100%", width: "100%", minHeight: "100%" }}>
            <ReactApexCharts
              series={chartData.tvl.series}
              type="area"
              height="550px"
              options={chartData.tvl.options}
            />
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Charts;
