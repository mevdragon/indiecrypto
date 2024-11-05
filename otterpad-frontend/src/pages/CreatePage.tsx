import React from "react";
import {
  Layout,
  Form,
  Input,
  InputNumber,
  Button,
  message,
  Card,
  Switch,
  Tooltip,
  Space,
  Select,
  Alert,
  Checkbox,
} from "antd";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useReadContract,
} from "wagmi";
import { isAddress, Address, decodeEventLog, zeroAddress } from "viem";
import { InfoCircleOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import AppLayout from "../AppLayout";
import { useMediaQuery } from "react-responsive";
import { OtterPadFactory__factory } from "../typechain-types";
import { v4 as uuidv4 } from "uuid";
import { OtterpadInfo } from "../components/Charts";
import { getFactoryAddress, SUPPORTED_CHAINS } from "../config";
import ChainWarning from "../components/ChainWarning";

interface FundForm {
  title: string;
  richInfoUrl?: string;
  description?: string;
  media?: string;
  website?: string;
  twitter?: string;
  saleToken: string;
  paymentToken: string;
  foundersWallet: string;
  lockedLPWallet?: string;
  startPrice: string;
  endPrice: string;
  targetLiquidity: string;
  upfrontRakeBPS: number;
  escrowRakeBPS: number;
  useCustomRichInfo: boolean;
}

const CreatePage: React.FC = () => {
  const [selectedChain, setSelectedChain] = React.useState(
    SUPPORTED_CHAINS[0].chainIdDecimal
  );
  const [form] = Form.useForm<FundForm>();
  const { isConnected } = useAccount();
  const isDesktop = useMediaQuery({ minWidth: 1024 });
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [useCustomInfo, setUseCustomInfo] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [txHash, setTxHash] = React.useState<`0x${string}`>();
  const publicClient = usePublicClient();
  const [metadata, setMetadata] = React.useState<OtterpadInfo | null>(null);
  const agreementValue = Form.useWatch("agreement", form);

  // Add fund counter read
  const factoryAddress = getFactoryAddress(selectedChain);
  const fundCounterResult = useReadContract({
    address: factoryAddress as Address,
    abi: OtterPadFactory__factory.abi,
    functionName: "fundCounterIndex",
  });
  console.log("fundCounterResult", fundCounterResult);

  const { writeContractAsync } = useWriteContract();

  const {
    data: receipt,
    isSuccess,
    isError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const saveMetadataToDatabase = async (info: OtterpadInfo) => {
    try {
      const response = await fetch(
        "https://api.legions.bot/api/w/officex/jobs/run_wait_result/f/f/officex/otterpad_rest_api?token=ixJCgjvjwtok1RyDjxeaWC1igjaoNWwF&payload=e30%3D",
        // "https://api.legions.bot/api/w/officex/capture_u/f/officex/otterpad_rest_api",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            route: "POST/fund",
            payload: info,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save metadata");
      }

      return await response.json();
    } catch (error) {
      console.error("Error saving metadata:", error);
      throw error;
    }
  };

  const handleCreateFund = async (values: FundForm) => {
    try {
      const factoryAddress = getFactoryAddress(selectedChain);
      const fundId = uuidv4();
      setIsSubmitting(true);

      let richInfoUrl: string;
      console.log(`values`, values);
      if (values.richInfoUrl) {
        richInfoUrl = values.richInfoUrl!;
      } else {
        // First save the metadata
        const otterpadInfo: OtterpadInfo = {
          title: values.title,
          description: values.description || "",
          media: values.media
            ? values.media.split(",").map((url) => url.trim())
            : [],
          website: values.website || "",
          twitter: values.twitter || "",
          chain_id_decimals: selectedChain,
          contract_address: "",
          otterpad_url: "",
        };
        // @ts-ignore
        setMetadata({ ...otterpadInfo, uid: fundId });

        // Use the complete URL with fund parameter
        richInfoUrl = `https://app.legions.bot/webhook/0c5cc860-244a-477c-a264-5a4602681d18?fund=${fundId}`;
      }

      console.log(`richInfoUrl`, richInfoUrl);

      messageApi.loading({
        content: "Please confirm the transaction in your wallet...",
        key: "txn",
        duration: 0,
      });

      const hash = await writeContractAsync({
        address: factoryAddress as Address,
        abi: OtterPadFactory__factory.abi,
        functionName: "createFundraiser",
        args: [
          BigInt(Math.max(values.upfrontRakeBPS, 200)),
          BigInt(values.escrowRakeBPS),
          BigInt(values.startPrice),
          BigInt(values.endPrice),
          BigInt(values.targetLiquidity),
          values.saleToken as Address,
          values.paymentToken as Address,
          values.foundersWallet as Address,
          values.title,
          richInfoUrl,
          (values.lockedLPWallet as Address) || zeroAddress,
        ],
      });

      messageApi.loading({
        content: "Transaction submitted. Waiting for confirmation...",
        key: "txn",
        duration: 0,
      });

      setTxHash(hash);
    } catch (error) {
      console.error("Create fund error:", error);
      messageApi.error({
        content:
          error instanceof Error ? error.message : "Failed to create fund",
        key: "txn",
        duration: 5,
      });
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    async function processTxReceipt() {
      if (isSuccess && receipt && publicClient) {
        try {
          // Get the return data from the transaction
          const result = await publicClient.getTransactionReceipt({
            hash: receipt.transactionHash,
          });

          // Find the contract creation event
          const fundAddressLog = result.logs.find((log) => {
            try {
              const decodedLog = decodeEventLog({
                abi: OtterPadFactory__factory.abi,
                data: log.data,
                topics: log.topics,
              });
              return decodedLog.eventName === "FundCreated";
            } catch {
              return false;
            }
          });

          if (fundAddressLog) {
            const decodedLog = decodeEventLog({
              abi: OtterPadFactory__factory.abi,
              data: fundAddressLog.data,
              topics: fundAddressLog.topics,
            });

            // Get the fund address from the decoded log
            const fundAddress = decodedLog.args.fund as string;

            messageApi.success({
              content: "Fund created successfully!",
              key: "txn",
              duration: 3,
            });

            if (metadata) {
              await saveMetadataToDatabase({
                ...metadata,
                contract_address: fundAddress,
                otterpad_url: `https://buy.indiecrypto.club/fund/${selectedChain}/${fundAddress}`,
              });
            }
            // Navigate to the fund page with the new address
            navigate(`/fund/${selectedChain}/${fundAddress}`);
          } else {
            throw new Error("Could not find fund creation event");
          }
        } catch (error) {
          console.error("Error processing receipt:", error);
          messageApi.error({
            content: "Error getting fund address",
            key: "txn",
            duration: 5,
          });
        }
        setIsSubmitting(false);
      }

      if (isError) {
        messageApi.error({
          content: "Transaction failed",
          key: "txn",
          duration: 5,
        });
        setIsSubmitting(false);
      }
    }

    processTxReceipt();
  }, [isSuccess, isError, receipt, messageApi, navigate, publicClient]);

  const validateEthereumAddress = (_: any, value: string) => {
    if (!value || !isAddress(value)) {
      return Promise.reject(new Error("Invalid Ethereum address"));
    }
    return Promise.resolve();
  };

  const handleCustomInfoChange = (checked: boolean) => {
    setUseCustomInfo(checked);
    form.setFieldsValue({ useCustomRichInfo: checked });
  };

  return (
    <AppLayout>
      {contextHolder}
      <Layout
        style={{
          minHeight: "100%",
          background: "#f5f5f5",
          padding: "42px 16px 16px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* <p style={{ marginBottom: "24px" }}>
          Total Funds Created:{" "}
          {fundCounter ? fundCounter.toString() : "Loading..."}
        </p> */}
        <Card
          title="Create Crypto Fundraiser"
          style={{
            width: isDesktop ? "600px" : "100%",
            maxWidth: "100%",
          }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreateFund}
            disabled={!isConnected || isSubmitting}
            initialValues={{
              useCustomRichInfo: false,
              upfrontRakeBPS: 200,
            }}
          >
            <Form.Item
              label={
                <Space>
                  Network
                  <Tooltip title="Select the blockchain network">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="chainId"
              initialValue={selectedChain}
              rules={[{ required: true, message: "Please select a network!" }]}
            >
              <Select
                onChange={(value) => setSelectedChain(value)}
                options={SUPPORTED_CHAINS.map((chain) => ({
                  label: chain.chain,
                  value: chain.chainIdDecimal,
                }))}
              />
            </Form.Item>
            <ChainWarning requiredChainId={selectedChain} />
            <Form.Item
              label={
                <Space>
                  Fund Title
                  <Tooltip title="The name of your fundraising campaign">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="title"
              rules={[
                { required: true, message: "Please input the fund title!" },
              ]}
            >
              <Input placeholder="Crypto Project" />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  Sale Token Address
                  <Tooltip title="The token address that will be sold in this fundraiser">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="saleToken"
              rules={[
                {
                  required: true,
                  message: "Please input the sale token address!",
                },
                { validator: validateEthereumAddress },
              ]}
            >
              <Input placeholder="0x..." />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  Payment Token Address
                  <Tooltip title="The token address that will be used for payments">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="paymentToken"
              rules={[
                {
                  required: true,
                  message: "Please input the payment token address!",
                },
                { validator: validateEthereumAddress },
              ]}
            >
              <Input placeholder="0x..." />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  Founders Wallet Address
                  <Tooltip title="The wallet address that will receive the funds">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="foundersWallet"
              rules={[
                {
                  required: true,
                  message: "Please input the founders wallet address!",
                },
                { validator: validateEthereumAddress },
              ]}
            >
              <Input placeholder="0x..." />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  Locked LP Token Wallet
                  <Tooltip title="Optional: The wallet address that will receive the locked LP tokens. If not set, LP tokens will be sent to zero address to be burnt">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="lockedLPWallet"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    return validateEthereumAddress(_, value);
                  },
                },
              ]}
            >
              <Input placeholder="0x... (Optional)" />
            </Form.Item>
            <Form.Item
              label={
                <Space>
                  Start Price
                  <Tooltip title="Initial token price at the start of the fundraiser in wei">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="startPrice"
              rules={[
                { required: true, message: "Please input the start price!" },
              ]}
            >
              <Input placeholder="0.0" />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  End Price
                  <Tooltip title="Final token price at the end of the fundraiser in wei">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="endPrice"
              rules={[
                { required: true, message: "Please input the end price!" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (
                      !value ||
                      parseFloat(getFieldValue("startPrice")) <
                        parseFloat(value)
                    ) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error("End price must be greater than start!")
                    );
                  },
                }),
              ]}
            >
              <Input placeholder="0.0" />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  Target Liquidity
                  <Tooltip title="Target amount of liquidity to be raised in wei">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="targetLiquidity"
              rules={[
                {
                  required: true,
                  message: "Please input the target liquidity!",
                },
              ]}
            >
              <Input placeholder="0.0" />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  Upfront Rake (BPS)
                  <Tooltip title="Initial fee in basis points (100 = 1%). Minimum is 200">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="upfrontRakeBPS"
              rules={[
                { required: true, message: "Please input the upfront rake!" },
              ]}
            >
              <InputNumber
                min={200}
                max={10000}
                style={{ width: "100%" }}
                placeholder="200"
              />
            </Form.Item>

            <Form.Item
              label={
                <Space>
                  Escrow Rake (BPS)
                  <Tooltip title="Escrow fee in basis points (100 = 1%). Minimum is 0">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              }
              name="escrowRakeBPS"
              rules={[
                { required: true, message: "Please input the escrow rake!" },
              ]}
            >
              <InputNumber
                min={0}
                max={10000}
                style={{ width: "100%" }}
                placeholder="100"
              />
            </Form.Item>

            <Form.Item
              label="Custom Metadata"
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "flex-start",
              }}
            >
              <Switch
                checked={useCustomInfo}
                onChange={handleCustomInfoChange}
                checkedChildren="Custom Metadata"
                unCheckedChildren="Standard Info"
              />
            </Form.Item>

            {useCustomInfo ? (
              <Form.Item
                label={
                  <Space>
                    URL to Metadata
                    <Tooltip title="Custom URL for additional fund information. This should be a JSON file you control and is retrievable by public GET request. Should take shape of { title: string, description: string, website: url, twitter: url, media: url[], chain_id_decimals: string }">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                }
                name="richInfoUrl"
                rules={[
                  {
                    required: true,
                    message: "Please input the rich info URL!",
                  },
                ]}
              >
                <Input placeholder="https://example.com/fund-info" />
              </Form.Item>
            ) : (
              <>
                <Form.Item
                  label={
                    <Space>
                      Description
                      <Tooltip title="Detailed description of your fund">
                        <InfoCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  name="description"
                >
                  <Input.TextArea
                    rows={4}
                    placeholder="Describe your fund..."
                  />
                </Form.Item>

                <Form.Item
                  label={
                    <Space>
                      Media URLs
                      <Tooltip title="Comma-separated list of media URLs">
                        <InfoCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  name="media"
                >
                  <Input placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg" />
                </Form.Item>

                <Form.Item
                  label={
                    <Space>
                      Website
                      <Tooltip title="Official website URL">
                        <InfoCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  name="website"
                >
                  <Input placeholder="https://example.com" />
                </Form.Item>

                <Form.Item
                  label={
                    <Space>
                      Twitter
                      <Tooltip title="Twitter url such as https://x.com/username">
                        <InfoCircleOutlined />
                      </Tooltip>
                    </Space>
                  }
                  name="twitter"
                >
                  <Input placeholder="https://x.com/username" />
                </Form.Item>
              </>
            )}

            <Form.Item>
              <Alert
                message="Important: Token Listing Requirements"
                description={
                  <>
                    <p>
                      This fundraiser is only for tokens that are not already
                      listed on Uniswap V2. Using this for already listed tokens
                      may result in unexpected behavior and potential loss of
                      funds.{" "}
                      <a
                        href="https://docs.indiecrypto.club/requirements"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Learn more
                      </a>
                    </p>
                    <Form.Item
                      name="agreement"
                      valuePropName="checked"
                      rules={[
                        {
                          validator: (_, value) =>
                            value
                              ? Promise.resolve()
                              : Promise.reject(
                                  new Error(
                                    "Please read and agree to the terms and conditions"
                                  )
                                ),
                        },
                      ]}
                      style={{ marginBottom: 0 }}
                    >
                      <Checkbox>
                        I understand and agree to the{" "}
                        <a
                          href="https://docs.indiecrypto.club/tos"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          terms & conditions
                        </a>{" "}
                        and risks associated with using permissionless
                        blockchain smart contracts. I confirm my token is not
                        already listed on Uniswap V2.
                      </Checkbox>
                    </Form.Item>
                  </>
                }
                type="warning"
                showIcon
                style={{ marginBottom: "16px" }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={isSubmitting}
                disabled={!isConnected || isSubmitting || !agreementValue}
                style={{ width: "100%" }}
              >
                {!isConnected
                  ? "Connect Wallet to Continue"
                  : isSubmitting
                  ? "Creating Fund..."
                  : "Create Fund"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Layout>
      <br />
      <br />
      <br />
      <br />
    </AppLayout>
  );
};

export default CreatePage;
