import React, { useState } from "react";
import { Modal, Checkbox, Button, Typography } from "antd";
const { Paragraph } = Typography;

const HowItWorksModal = ({
  isOpen,
  toggleModal,
}: {
  isOpen: boolean;
  toggleModal: (bool: boolean) => void;
}) => {
  const [isAgreed, setIsAgreed] = useState(false);

  const handleClose = () => {
    setIsAgreed(false); // Reset checkbox when modal closes
    toggleModal(false);
  };

  return (
    <Modal
      title="How It Works"
      open={isOpen}
      onCancel={handleClose}
      maskClosable={false}
      closable={false}
      footer={[
        <Button
          key="submit"
          type="primary"
          disabled={!isAgreed}
          onClick={handleClose}
        >
          Continue
        </Button>,
      ]}
    >
      <Paragraph>
        Indie Crypto is an investor community & crypto launchpad for ambitious
        small teams. Designed with builder-friendly investor protections.
      </Paragraph>

      <Paragraph>How it works for crypto investors, step by step:</Paragraph>

      <ol>
        <li>
          <b style={{ color: "rgb(22, 119, 255)" }}>
            Buy tokens early for better price.
          </b>{" "}
          Tokens are sold on a linear bonding curve, which provides stability
          and profit.
        </li>
        <li>
          <b style={{ color: "rgb(22, 119, 255)" }}>Get refunds anytime</b>{" "}
          before fundraiser ends. Tokens are locked until the liquidity goal is
          reached, ensuring healthy launch.
        </li>
        <li>
          <b style={{ color: "rgb(22, 119, 255)" }}>Trade tokens for profit.</b>{" "}
          Liquidity is deployed to Uniswap when the fundraiser ends. Redeem your
          tokens in the "My Orders" tab.
        </li>
      </ol>

      <Paragraph>
        Be careful when buying cryptocurrency! Always do proper due diligence.
        IndieCrypto is permissionless, which means anyone can fundraise from the
        public internet. <b style={{ color: "#f30814" }}>Beware of scams.</b>
      </Paragraph>

      <div style={{ marginTop: 24 }}>
        <Checkbox
          checked={isAgreed}
          onChange={(e) => setIsAgreed(e.target.checked)}
        >
          I agree to{" "}
          <a href="https://indiecrypto.club/tos" target="_blank">
            terms & conditions
          </a>{" "}
          and understand the risks
        </Checkbox>
      </div>
    </Modal>
  );
};

export default HowItWorksModal;
