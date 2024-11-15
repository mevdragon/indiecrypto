import { Address } from "viem";

// src/config/chains.ts
export interface ChainConfig {
  chain: string;
  chainIdDecimal: string;
  factoryAddress: string;
  presaleFactory: string;
  isDisabled: boolean;
  explorerUrl: string;
  uniswapV2Factory: Address;
  geckoTerminalChainSlug?: string;
  dexScreenerSlug?: string;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    chain: "Sepolia",
    chainIdDecimal: "11155111",
    factoryAddress: "0x7D46d5b37bD2515ED9c39c45B267342f3dd47b9a",
    presaleFactory: "0x5d79401D1e0310235399F5293aeca0524BF83136",
    isDisabled: false,
    explorerUrl: "https://sepolia.etherscan.io",
    uniswapV2Factory: "0xF62c03E08ada871A0bEb309762E260a7a6a880E6",
    geckoTerminalChainSlug: "sepolia-testnet",
    dexScreenerSlug: "sepolia",
  },
  {
    chain: "Polygon",
    chainIdDecimal: "137",
    factoryAddress: "0x8D7ee9Ae4170BE5B98f6d5a6A4a1fc595eAeF414",
    presaleFactory: "0x7cf0aA18e413ed98B0983A7567cfB95303D279EA",
    isDisabled: false,
    explorerUrl: "https://polygonscan.com",
    uniswapV2Factory: "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C",
    geckoTerminalChainSlug: "polygon_pos",
    dexScreenerSlug: "polygon",
  },
  {
    chain: "Base",
    chainIdDecimal: "8453",
    factoryAddress: "0x4296ac43F23EA581FBFCA2550740AFB652AD4655",
    presaleFactory: "0xaC1136fB4C60A0604252d870c72E20Aca60749fc",
    isDisabled: false,
    explorerUrl: "https://basescan.org/",
    uniswapV2Factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    geckoTerminalChainSlug: "base",
    dexScreenerSlug: "base",
  },
  // {
  //   chain: "Arbitrum One",
  //   chainIdDecimal: "42161",
  //   factoryAddress: "0x4BaC8705e5029a028ee67fDbC6767598fB1E6fEc",
  //   isDisabled: false,
  //   explorerUrl: "https://arbiscan.io",
  //   geckoTerminalChainSlug: "arbitrum",
  // },
  // {
  //   chain: "Base Mainnet",
  //   chainIdDecimal: "8453",
  //   factoryAddress: "___________", // To be filled
  //   isDisabled: true,
  //   explorerUrl: "https://basescan.org",
  // },
];

export const getPresaleFactory = (chainId: string): string => {
  const chain = SUPPORTED_CHAINS.find((c) => c.chainIdDecimal === chainId);
  if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
  return chain.presaleFactory;
};

export const getFactoryAddress = (chainId: string): string => {
  const chain = SUPPORTED_CHAINS.find((c) => c.chainIdDecimal === chainId);
  if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
  return chain.factoryAddress;
};

export const getUniswapV2Factory = (chainId: string): Address => {
  const chain = SUPPORTED_CHAINS.find((c) => c.chainIdDecimal === chainId);
  if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
  return chain.uniswapV2Factory;
};

export const getChainName = (chainId: string): string => {
  const chain = SUPPORTED_CHAINS.find((c) => c.chainIdDecimal === chainId);
  if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
  return chain.chain;
};

export const getExplorerUrl = (chainId: string): string => {
  const chain = SUPPORTED_CHAINS.find((c) => c.chainIdDecimal === chainId);
  if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
  return chain.explorerUrl;
};

export const getGeckoTerminalChainSlug = (
  chainId: string
): string | undefined => {
  const chain = SUPPORTED_CHAINS.find((c) => c.chainIdDecimal === chainId);
  return chain?.geckoTerminalChainSlug;
};

export const getDexScreenerChainSlug = (
  chainId: string
): string | undefined => {
  const chain = SUPPORTED_CHAINS.find((c) => c.chainIdDecimal === chainId);
  return chain?.dexScreenerSlug;
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
