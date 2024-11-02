import { ApexOptions } from "apexcharts";
import { Address } from "viem";
import ReactApexCharts from "react-apexcharts";
import dayjs from "dayjs";
import { ContractDataResult } from "../pages/FundraiserPage";
import { Tabs } from "antd";
import TabPane from "antd/es/tabs/TabPane";
import { ShoppingCartOutlined } from "@ant-design/icons";

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

const Charts = ({
  address,
  contractData,
}: {
  address: Address;
  contractData: ContractDataResult | null;
}) => {
  console.log(address);
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
  return (
    <div
      id="chart"
      style={{
        flex: 1,
        maxHeight: "100vh",
        textAlign: "left",
        minHeight: "75vh",
        width: "100%",
      }}
    >
      <Tabs
        defaultActiveKey="tvl"
        style={{
          background: "white",
          borderRadius: "8px",
          height: "75vh",
          padding: "16px",
        }}
      >
        {/* Buy Tokens Tab */}
        <TabPane
          tab={
            <span>
              <ShoppingCartOutlined />
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
              height="500px"
              options={chartData.options}
            />
          </div>
        </TabPane>
        <TabPane
          tab={
            <span>
              <ShoppingCartOutlined />
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
              height="100%"
              minHeight="100%"
              options={chartData.options}
            />
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Charts;
