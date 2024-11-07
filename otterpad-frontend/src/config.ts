// src/config/chains.ts
export interface ChainConfig {
  chain: string;
  chainIdDecimal: string;
  factoryAddress: string;
  isDisabled: boolean;
  explorerUrl: string;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    chain: "Sepolia Testnet",
    chainIdDecimal: "11155111",
    factoryAddress: "0x486D8b9693ca32Fe78431A0426E78f7798D3cF93",
    isDisabled: false,
    explorerUrl: "https://sepolia.etherscan.io",
  },
  {
    chain: "Base Mainnet",
    chainIdDecimal: "8453",
    factoryAddress: "", // To be filled
    isDisabled: true,
    explorerUrl: "https://basescan.org",
  },
];

export const getFactoryAddress = (chainId: string): string => {
  const chain = SUPPORTED_CHAINS.find((c) => c.chainIdDecimal === chainId);
  if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
  return chain.factoryAddress;
};

export const ERC20_ABI = [
  {
    inputs: [
      {
        name: "owner",
        type: "address",
      },
      {
        name: "spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        name: "spender",
        type: "address",
      },
      {
        name: "amount",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        name: "recipient",
        type: "address",
      },
      {
        name: "amount",
        type: "uint256",
      },
    ],
    name: "transfer",
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        name: "account",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [
      {
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
