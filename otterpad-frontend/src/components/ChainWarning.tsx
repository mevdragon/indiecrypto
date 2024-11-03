// src/components/ChainWarning.tsx
import React from "react";
import { Alert, Button } from "antd";
import { useChainId, useSwitchChain } from "wagmi";
import { SUPPORTED_CHAINS } from "../config";
import { toInteger } from "lodash";

interface ChainWarningProps {
  requiredChainId: string;
}

const ChainWarning: React.FC<ChainWarningProps> = ({ requiredChainId }) => {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  const requiredChain = SUPPORTED_CHAINS.find(
    (c) => c.chainIdDecimal === requiredChainId
  );

  if (!chainId || !requiredChain) return null;

  // Convert chain IDs to numbers for comparison
  const currentChainId = chainId?.toString();
  if (currentChainId === requiredChainId) return null;

  console.log(`requiredChainId: ${requiredChainId}`);

  return (
    <Alert
      message="Wrong Network"
      description={
        <div>
          <p>
            Please switch to {requiredChain.chain} to continue. Chain ID#
            {requiredChainId}
          </p>
          {/* {switchChain && (
            <Button
              type="primary"
              onClick={() =>
                switchChain({ chainId: toInteger(requiredChainId) })
              }
              loading={isPending}
            >
              Switch to {requiredChain.chain}
            </Button>
          )} */}
        </div>
      }
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
    />
  );
};

export default ChainWarning;
