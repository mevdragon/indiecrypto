import { ApexOptions } from "apexcharts";
import { Address, formatUnits } from "viem";
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
  Input,
  message,
} from "antd";
import TabPane from "antd/es/tabs/TabPane";
import {
  AreaChartOutlined,
  CopyOutlined,
  ExportOutlined,
  GlobalOutlined,
  LineChartOutlined,
  ShoppingCartOutlined,
  SlidersFilled,
  TwitterOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import { useBlockNumber, usePublicClient } from "wagmi";
import DexTabPane from "./DexTabPane";
import { SUPPORTED_CHAINS } from "../config";

const { Title, Paragraph } = Typography;

const INTERVAL = {
  MINUTE: 60,
  HOUR: 60 * 60,
  DAY: 24 * 60 * 60,
};

const formatWithDecimals = (value: number, decimals: number = 18) => {
  const divisor = Math.pow(10, decimals);
  return Number((value / divisor).toFixed(2));
};

const DEFAULT_PROJECT_IMAGE =
  "https://firebasestorage.googleapis.com/v0/b/arbitrage-bot-ea10c.appspot.com/o/generic-sharing%2Fotterpad%2FOtterpad%204%20(4).png?alt=media&token=210c3683-732f-4de7-a7b7-925419caee9e";

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
  chainIdDecimal,
  contractData,
  refetchContractDetails,
}: {
  address: Address;
  chainIdDecimal: string;
  contractData: ContractDataResult | null;
  refetchContractDetails: () => void;
}) => {
  const [otterpadInfo, setOtterpadInfo] = useState<OtterpadInfo | null>(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const publicClient = usePublicClient();
  const isDesktop = window.innerWidth >= 1024; // You can also use your useMediaQuery hook here
  const { data: currentBlock } = useBlockNumber();
  const [activeTab, setActiveTab] = useState("dex");

  const defaultTabPane = contractData?.isDeployedToUniswap ? "dex" : "price";

  useEffect(() => {
    if (contractData?.isDeployedToUniswap) {
      setActiveTab("dex");
    }
  }, [contractData?.isDeployedToUniswap]);

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

      const timeInterval = INTERVAL.HOUR;
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
              Number(contractData.paymentTokenDecimals)
            ),
            netActiveContributions: formatWithDecimals(
              Number(e.args.netActiveContributions),
              Number(contractData.paymentTokenDecimals)
            ),
            type: "purchase",
          })),
          ...refundEvents.map((e) => ({
            timestamp: Number(e.args.timestamp),
            amount: formatWithDecimals(
              Number(e.args.contributionAmount),
              Number(contractData.paymentTokenDecimals)
            ),
            netActiveContributions: formatWithDecimals(
              Number(e.args.netActiveContributions),
              Number(contractData.paymentTokenDecimals)
            ),
            type: "refund",
          })),
        ].sort((a, b) => a.timestamp - b.timestamp);

        if (allEvents.length === 0) {
          console.log("No events found");
          setIsFetchingHistory(false);
          return;
        }

        // Process minute intervals
        const intervalData = new Map();
        const firstTimestamp = allEvents[0].timestamp;
        const lastTimestamp = allEvents[allEvents.length - 1].timestamp;
        const startInterval =
          Math.floor(firstTimestamp / timeInterval) * timeInterval;
        const endInterval =
          Math.ceil(lastTimestamp / timeInterval) * timeInterval;
        let lowestTVL = allEvents[0].netActiveContributions;
        let highestTVL = allEvents[0].netActiveContributions;
        let currentTVL = allEvents[0].netActiveContributions;

        // Initialize first interval
        intervalData.set(startInterval, {
          open: allEvents[0].netActiveContributions,
          high: allEvents[0].netActiveContributions,
          low: allEvents[0].netActiveContributions,
          close: allEvents[0].netActiveContributions,
          timestamp: startInterval * 1000,
        });

        // Process each minute interval
        for (
          let timestamp = startInterval;
          timestamp <= endInterval;
          timestamp += timeInterval
        ) {
          const eventsInInterval = allEvents.filter(
            (e) =>
              Math.floor(e.timestamp / timeInterval) * timeInterval ===
              timestamp
          );

          const prevInterval = intervalData.get(timestamp - timeInterval);
          const prevClose = prevInterval ? prevInterval.close : currentTVL;

          if (eventsInInterval.length > 0) {
            const lastEvent = eventsInInterval[eventsInInterval.length - 1];
            currentTVL = lastEvent.netActiveContributions;

            const high = Math.max(
              ...eventsInInterval.map((e) => e.netActiveContributions)
            );
            const low = Math.min(
              ...eventsInInterval.map((e) => e.netActiveContributions)
            );
            lowestTVL = Math.min(lowestTVL, low);

            intervalData.set(timestamp, {
              open: prevClose,
              high,
              low,
              close: currentTVL,
              timestamp: timestamp * 1000,
            });
          } else {
            intervalData.set(timestamp, {
              open: prevClose,
              high: prevClose,
              low: prevClose,
              close: prevClose,
              timestamp: timestamp * 1000,
            });
          }
        }

        console.log("allEvents", allEvents);

        // Calculate price data based on TVL
        const calculatePrice = (tvl: number) => {
          if (
            !contractData.startPrice ||
            !contractData.endPrice ||
            !contractData.targetLiquidity
          )
            return 0;

          const startPrice = parseFloat(
            formatUnits(
              contractData.startPrice,
              contractData.paymentTokenDecimals
            )
          );
          const endPrice = parseFloat(
            formatUnits(
              contractData.endPrice,
              contractData.paymentTokenDecimals
            )
          );
          const targetLiquidity = parseFloat(
            formatUnits(
              contractData.targetLiquidity,
              contractData.paymentTokenDecimals
            )
          );

          if (tvl >= targetLiquidity) {
            return endPrice;
          }

          return startPrice + ((endPrice - startPrice) * tvl) / targetLiquidity;
        };

        const tvlData = Array.from(intervalData.values()).map((interval) => ({
          date: new Date(interval.timestamp).toISOString(),
          tvl: interval.close,
        }));

        // Convert to candlestick format
        const candlesticks = Array.from(intervalData.values()).map(
          (interval) => ({
            x: new Date(interval.timestamp),
            y: [interval.open, interval.high, interval.low, interval.close].map(
              (val) => Number(val.toFixed(2))
            ),
          })
        );

        const priceData = candlesticks.map((tvlCandle) => ({
          x: tvlCandle.x,
          y: tvlCandle.y.map((tvl) => Number(calculatePrice(tvl).toFixed(4))),
        }));

        // Initialize first interval
        intervalData.set(startInterval, {
          open: allEvents[0].netActiveContributions,
          high: allEvents[0].netActiveContributions,
          low: allEvents[0].netActiveContributions,
          close: allEvents[0].netActiveContributions,
          timestamp: startInterval * 1000,
        });

        // Process each minute interval
        for (
          let timestamp = startInterval;
          timestamp <= endInterval;
          timestamp += 60
        ) {
          const eventsInMinute = allEvents.filter(
            (e) => Math.floor(e.timestamp / 60) * 60 === timestamp
          );

          const prevMinute = intervalData.get(timestamp - 60);
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

            intervalData.set(timestamp, {
              open: prevClose,
              high,
              low,
              close: currentTVL,
              timestamp: timestamp * 1000,
            });
          } else {
            intervalData.set(timestamp, {
              open: prevClose,
              high: prevClose,
              low: prevClose,
              close: prevClose,
              timestamp: timestamp * 1000,
            });
          }
        }

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
      setIsFetchingHistory(false);
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

  const getExplorerUrl = () => {
    const chain = SUPPORTED_CHAINS.find(
      (chain) => chain.chainIdDecimal === chainIdDecimal
    );
    return chain?.explorerUrl || "";
  };

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    message.success("Contract address copied to clipboard");
  };

  const handleExplorerLink = (address: string) => {
    const explorerUrl = getExplorerUrl();
    if (explorerUrl) {
      window.open(`${explorerUrl}/address/${address}#readContract`, "_blank");
    }
  };

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
        defaultActiveKey={defaultTabPane}
        onTabClick={(key) => setActiveTab(key)}
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
              <ShoppingCartOutlined style={{ marginRight: "5px" }} />
              About
            </span>
          }
          key="about"
          style={{ height: "100%", minHeight: "100%" }}
        >
          <div style={{ display: "flex", flexDirection: "row", gap: 0 }}>
            <Input
              value={contractData?.saleTokenAddress}
              readOnly
              size="small"
              style={{ width: "200px", marginRight: "5px" }}
              prefix={
                <span style={{ fontWeight: "bold", color: "#1677ff" }}>
                  {contractData?.saleTokenSymbol}
                </span>
              }
              suffix={
                <>
                  <CopyOutlined
                    className="cursor-pointer mx-1"
                    onClick={() =>
                      handleCopy(contractData?.saleTokenAddress || "")
                    }
                  />
                  <ExportOutlined
                    className="cursor-pointer mx-1"
                    onClick={() =>
                      handleExplorerLink(contractData?.saleTokenAddress || "")
                    }
                  />
                </>
              }
            />
            <Input
              value={contractData?.paymentTokenAddress}
              readOnly
              size="small"
              style={{ width: "200px", marginRight: "5px" }}
              prefix={
                <span style={{ fontWeight: "bold", color: "#1677ff" }}>
                  {contractData?.paymentTokenSymbol}
                </span>
              }
              suffix={
                <>
                  <CopyOutlined
                    className="cursor-pointer mx-1"
                    onClick={() =>
                      handleCopy(contractData?.paymentTokenAddress || "")
                    }
                  />
                  <ExportOutlined
                    className="cursor-pointer mx-1"
                    onClick={() =>
                      handleExplorerLink(
                        contractData?.paymentTokenAddress || ""
                      )
                    }
                  />
                </>
              }
            />
          </div>
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
                {otterpadInfo.media && otterpadInfo.media.length > 0 && (
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
                              src={url || DEFAULT_PROJECT_IMAGE}
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
              <LineChartOutlined style={{ marginRight: "5px" }} />
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
              <AreaChartOutlined style={{ marginRight: "5px" }} />
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
        <TabPane
          tab={
            <span>
              <SlidersFilled style={{ marginRight: "5px" }} />
              DEX
            </span>
          }
          key="dex"
          style={{ height: "100%", minHeight: "100%" }}
        >
          <DexTabPane
            address={address}
            chainIdDecimal={chainIdDecimal}
            contractData={contractData}
            refetchContractDetails={refetchContractDetails}
          />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Charts;
