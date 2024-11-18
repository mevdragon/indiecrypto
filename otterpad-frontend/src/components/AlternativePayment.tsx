import {
  CopyOutlined,
  ExportOutlined,
  SmileOutlined,
  TagsFilled,
} from "@ant-design/icons";
import { Button, Input, message, notification } from "antd";
import { useEffect } from "react";
import { OtterpadInfo } from "../pages/TrendingPage";
import { ContractDataResult } from "../pages/FundPage";
import { getExplorerUrl } from "../config";
import { Link } from "react-router-dom";

const AlternativePayment = ({
  contractData,
  otterpadInfo,
  chainIdDecimal,
}: {
  contractData: ContractDataResult | null;
  otterpadInfo: OtterpadInfo | null;
  chainIdDecimal: string;
}) => {
  const [api, contextHolder] = notification.useNotification();

  useEffect(() => {
    if (
      otterpadInfo &&
      otterpadInfo.alternative_payment_address &&
      otterpadInfo.alternative_payment_url
    ) {
      openNotification();
    }
  }, [otterpadInfo]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success("Contract address copied to clipboard");
  };

  const handleExplorerLink = (url: string) => {
    window.open(url, "_blank");
  };

  const handlePaymentTokenLink = () => {
    const explorerUrl = getExplorerUrl(chainIdDecimal);
    if (explorerUrl) {
      window.open(
        `${explorerUrl}/address/${contractData?.paymentTokenAddress}`,
        "_blank"
      );
    }
  };

  const openNotification = () => {
    api.open({
      message: "Alternative Payments",
      description: (
        <>
          <span>
            Don't want to connect wallet? You can also buy directly by sending{" "}
            <span onClick={handlePaymentTokenLink} style={{ color: "#1677ff" }}>
              {contractData?.paymentTokenSymbol}
            </span>{" "}
            to:
          </span>
          <Input
            value={otterpadInfo?.alternative_payment_address}
            readOnly
            onClick={() =>
              handleCopy(otterpadInfo?.alternative_payment_address || "")
            }
            size="small"
            style={{
              width: "100%",
              color: "#1677ff",
              fontWeight: "bold",
              cursor: "bold",
              margin: "10px 0px",
            }}
            suffix={
              <div
                onClick={() =>
                  handleCopy(otterpadInfo?.alternative_payment_address || "")
                }
              >
                Copy
                <CopyOutlined
                  className="cursor-pointer mx-1"
                  style={{ margin: "0px 5px" }}
                />
                <ExportOutlined
                  className="cursor-pointer mx-1"
                  onClick={() =>
                    handleExplorerLink(
                      otterpadInfo?.alternative_payment_url || ""
                    )
                  }
                />
              </div>
            }
          />
          <span>
            Accepts {contractData?.paymentTokenSymbol} on Ethereum, Polygon PoS,
            BaseL2, Binance Smart Chain, Arbitrum, Optimism. 2% fee applies. Up
            to 24 hours to verify onchain.{" "}
            <Link to="/altpay" target="_blank" style={{ color: "#1677ff" }}>
              Learn more
            </Link>
          </span>
        </>
      ),

      icon: <TagsFilled style={{ color: "#108ee9" }} />,
      duration: 0,
      placement: "bottomRight",
    });
  };

  return <>{contextHolder}</>;
};

export default AlternativePayment;
