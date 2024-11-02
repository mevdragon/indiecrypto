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
  console.log(address);
  console.log(contractData);

  const [otterpadInfo, setOtterpadInfo] = useState<OtterpadInfo | null>(null);

  const publicClient = usePublicClient();
  const { data: currentBlock } = useBlockNumber();
  const [chartData, setChartData] = useState<{
    tvl: ChartData;
    price: ChartData;
  }>({
    tvl: {
      series: [{ name: "TVL", data: [] }],
      options: {
        chart: {
          type: "candlestick",
          height: 350,
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
        title: { text: "Total Value Locked", align: "left" },
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
          labels: { formatter: (val: number) => val.toFixed(2) },
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

        // Convert to candlestick format
        const tvlData = Array.from(minuteData.values()).map((minute) => ({
          x: new Date(minute.timestamp),
          y: [minute.open, minute.high, minute.low, minute.close].map((val) =>
            Number(val.toFixed(2))
          ),
        }));

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

        const priceData = tvlData.map((tvlCandle) => ({
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

        // Update both charts simultaneously
        setChartData((prev) => ({
          tvl: {
            series: [{ name: "TVL", data: tvlData }],
            options: {
              ...prev.tvl.options,
              yaxis: {
                ...prev.tvl.options.yaxis,
                min: Math.max(0, lowestTVL * 0.95),
                max: Math.max(
                  formatPrice(contractData.targetLiquidity) * 1.05,
                  highestTVL * 1.05
                ),
              },
              xaxis: {
                ...prev.tvl.options.xaxis,
                min: firstTimestamp * 1000,
                max: lastTimestamp * 1000,
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
      } catch (error) {
        console.error("Error fetching and processing data:", error);
      }
    };

    fetchAndProcessData();
  }, [address, currentBlock, publicClient, contractData]);

  // const chartData = {
  //   series: [
  //     {
  //       name: "candle",
  //       data: [
  //         {
  //           x: new Date(1538778600000),
  //           // y: [buyFat, buyThin, sellThin, sellFat],
  //           y: [6629.81, 6629.81, 6623.04, 6623.04],
  //         },
  //         {
  //           x: new Date(1538780400000),
  //           y: [6632.01, 6643.59, 6620, 6630.11],
  //         },
  //         {
  //           x: new Date(1538782200000),
  //           y: [6635.65, 6635.65, 6635.65, 6635.65],
  //         },
  //         {
  //           x: new Date(1538784000000),
  //           y: [6635.65, 6635.65, 6635.65, 6635.65],
  //         },
  //         {
  //           x: new Date(1538785800000),
  //           y: [6638.24, 6640, 6620, 6624.47],
  //         },
  //         {
  //           x: new Date(1538787600000),
  //           y: [6624.53, 6636.03, 6621.68, 6624.31],
  //         },
  //         {
  //           x: new Date(1538789400000),
  //           y: [6624.61, 6632.2, 6617, 6626.02],
  //         },
  //         {
  //           x: new Date(1538791200000),
  //           y: [6627, 6627.62, 6584.22, 6603.02],
  //         },
  //         {
  //           x: new Date(1538793000000),
  //           y: [6605, 6608.03, 6598.95, 6604.01],
  //         },
  //         {
  //           x: new Date(1538794800000),
  //           y: [6604.5, 6614.4, 6602.26, 6608.02],
  //         },
  //         {
  //           x: new Date(1538796600000),
  //           y: [6608.02, 6610.68, 6601.99, 6608.91],
  //         },
  //         {
  //           x: new Date(1538798400000),
  //           y: [6608.91, 6618.99, 6608.01, 6612],
  //         },
  //         {
  //           x: new Date(1538800200000),
  //           y: [6612, 6615.13, 6605.09, 6612],
  //         },
  //         {
  //           x: new Date(1538802000000),
  //           y: [6612, 6624.12, 6608.43, 6622.95],
  //         },
  //         {
  //           x: new Date(1538803800000),
  //           y: [6623.91, 6623.91, 6615, 6615.67],
  //         },
  //         {
  //           x: new Date(1538805600000),
  //           y: [6618.69, 6618.74, 6610, 6610.4],
  //         },
  //         {
  //           x: new Date(1538807400000),
  //           y: [6611, 6622.78, 6610.4, 6614.9],
  //         },
  //         {
  //           x: new Date(1538809200000),
  //           y: [6614.9, 6626.2, 6613.33, 6623.45],
  //         },
  //         {
  //           x: new Date(1538811000000),
  //           y: [6623.48, 6627, 6618.38, 6620.35],
  //         },
  //         {
  //           x: new Date(1538812800000),
  //           y: [6619.43, 6620.35, 6610.05, 6615.53],
  //         },
  //         {
  //           x: new Date(1538814600000),
  //           y: [6615.53, 6617.93, 6610, 6615.19],
  //         },
  //         {
  //           x: new Date(1538816400000),
  //           y: [6615.19, 6621.6, 6608.2, 6620],
  //         },
  //         {
  //           x: new Date(1538818200000),
  //           y: [6619.54, 6625.17, 6614.15, 6620],
  //         },
  //         {
  //           x: new Date(1538820000000),
  //           y: [6620.33, 6634.15, 6617.24, 6624.61],
  //         },
  //         {
  //           x: new Date(1538821800000),
  //           y: [6625.95, 6626, 6611.66, 6617.58],
  //         },
  //         {
  //           x: new Date(1538823600000),
  //           y: [6619, 6625.97, 6595.27, 6598.86],
  //         },
  //         {
  //           x: new Date(1538825400000),
  //           y: [6598.86, 6598.88, 6570, 6587.16],
  //         },
  //         {
  //           x: new Date(1538827200000),
  //           y: [6588.86, 6600, 6580, 6593.4],
  //         },
  //         {
  //           x: new Date(1538829000000),
  //           y: [6593.99, 6598.89, 6585, 6587.81],
  //         },
  //         {
  //           x: new Date(1538830800000),
  //           y: [6587.81, 6592.73, 6567.14, 6578],
  //         },
  //         {
  //           x: new Date(1538832600000),
  //           y: [6578.35, 6581.72, 6567.39, 6579],
  //         },
  //         {
  //           x: new Date(1538834400000),
  //           y: [6579.38, 6580.92, 6566.77, 6575.96],
  //         },
  //         {
  //           x: new Date(1538836200000),
  //           y: [6575.96, 6589, 6571.77, 6588.92],
  //         },
  //         {
  //           x: new Date(1538838000000),
  //           y: [6588.92, 6594, 6577.55, 6589.22],
  //         },
  //         {
  //           x: new Date(1538839800000),
  //           y: [6589.3, 6598.89, 6589.1, 6596.08],
  //         },
  //         {
  //           x: new Date(1538841600000),
  //           y: [6597.5, 6600, 6588.39, 6596.25],
  //         },
  //         {
  //           x: new Date(1538843400000),
  //           y: [6598.03, 6600, 6588.73, 6595.97],
  //         },
  //         {
  //           x: new Date(1538845200000),
  //           y: [6595.97, 6602.01, 6588.17, 6602],
  //         },
  //         {
  //           x: new Date(1538847000000),
  //           y: [6602, 6607, 6596.51, 6599.95],
  //         },
  //         {
  //           x: new Date(1538848800000),
  //           y: [6600.63, 6601.21, 6590.39, 6591.02],
  //         },
  //         {
  //           x: new Date(1538850600000),
  //           y: [6591.02, 6603.08, 6591, 6591],
  //         },
  //         {
  //           x: new Date(1538852400000),
  //           y: [6591, 6601.32, 6585, 6592],
  //         },
  //         {
  //           x: new Date(1538854200000),
  //           y: [6593.13, 6596.01, 6590, 6593.34],
  //         },
  //         {
  //           x: new Date(1538856000000),
  //           y: [6593.34, 6604.76, 6582.63, 6593.86],
  //         },
  //         {
  //           x: new Date(1538857800000),
  //           y: [6593.86, 6604.28, 6586.57, 6600.01],
  //         },
  //         {
  //           x: new Date(1538859600000),
  //           y: [6601.81, 6603.21, 6592.78, 6596.25],
  //         },
  //         {
  //           x: new Date(1538861400000),
  //           y: [6596.25, 6604.2, 6590, 6602.99],
  //         },
  //         {
  //           x: new Date(1538863200000),
  //           y: [6602.99, 6606, 6584.99, 6587.81],
  //         },
  //         {
  //           x: new Date(1538865000000),
  //           y: [6587.81, 6595, 6583.27, 6591.96],
  //         },
  //         {
  //           x: new Date(1538866800000),
  //           y: [6591.97, 6596.07, 6585, 6588.39],
  //         },
  //         {
  //           x: new Date(1538868600000),
  //           y: [6587.6, 6598.21, 6587.6, 6594.27],
  //         },
  //         {
  //           x: new Date(1538870400000),
  //           y: [6596.44, 6601, 6590, 6596.55],
  //         },
  //         {
  //           x: new Date(1538872200000),
  //           y: [6598.91, 6605, 6596.61, 6600.02],
  //         },
  //         {
  //           x: new Date(1538874000000),
  //           y: [6600.55, 6605, 6589.14, 6593.01],
  //         },
  //         {
  //           x: new Date(1538875800000),
  //           y: [6593.15, 6605, 6592, 6603.06],
  //         },
  //         {
  //           x: new Date(1538877600000),
  //           y: [6603.07, 6604.5, 6599.09, 6603.89],
  //         },
  //         {
  //           x: new Date(1538879400000),
  //           y: [6604.44, 6604.44, 6600, 6603.5],
  //         },
  //         {
  //           x: new Date(1538881200000),
  //           y: [6603.5, 6603.99, 6597.5, 6603.86],
  //         },
  //         {
  //           x: new Date(1538883000000),
  //           y: [6603.85, 6605, 6600, 6604.07],
  //         },
  //         {
  //           x: new Date(1538884800000),
  //           y: [6604.98, 6606, 6604.07, 6606],
  //         },
  //       ], // generateBullishData(),
  //     },
  //   ],
  //   options: {
  //     chart: {
  //       height: 350,
  //       type: "candlestick",
  //       id: "candlestick-fundraiser",
  //     },
  //     title: {
  //       text: `TVL - ${contractData?.title}`,
  //       align: "left",
  //     },
  //     annotations: {
  //       xaxis: [
  //         {
  //           x: "Oct 06 14:00",
  //           borderColor: "#00E396",
  //           label: {
  //             borderColor: "#00E396",
  //             style: {
  //               fontSize: "12px",
  //               color: "#fff",
  //               background: "#00E396",
  //             },
  //             orientation: "horizontal",
  //             offsetY: 7,
  //             text: "Annotation Test",
  //           },
  //         },
  //       ],
  //     },
  //     tooltip: {
  //       enabled: true,
  //     },
  //     xaxis: {
  //       type: "datetime",
  //       labels: {
  //         formatter: function (val: any) {
  //           return dayjs(val).format("MMM DD HH:mm");
  //         },
  //       },
  //     },
  //     yaxis: {
  //       tooltip: {
  //         enabled: true,
  //       },
  //     },
  //   } as ApexOptions,
  // };

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
          <div style={{ height: "100%", width: "100%", minHeight: "100%" }}>
            <ReactApexCharts
              series={chartData.tvl.series}
              type="candlestick"
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
