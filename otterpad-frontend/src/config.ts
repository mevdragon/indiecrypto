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
    factoryAddress: "0x865F59093a8C29dEF3021B5998Bf6cA10337D167",
    presaleFactory: "0xEC6EF62E6F07e2D30fDd0b99c483E6Fa3389d942",
    isDisabled: false,
    explorerUrl: "https://sepolia.etherscan.io",
    uniswapV2Factory: "0xF62c03E08ada871A0bEb309762E260a7a6a880E6",
    geckoTerminalChainSlug: "sepolia-testnet",
    dexScreenerSlug: "sepolia",
  },
  {
    chain: "Polygon",
    chainIdDecimal: "137",
    factoryAddress: "0xCFEd741beefbb3D0aBFf052Acd1Dcf2bADE4f73F",
    presaleFactory: "0x20500031477a9e29CA4659c00bbd55F33a714FCA",
    isDisabled: false,
    explorerUrl: "https://polygonscan.com",
    uniswapV2Factory: "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C",
    geckoTerminalChainSlug: "polygon_pos",
    dexScreenerSlug: "polygon",
  },
  {
    chain: "Base",
    chainIdDecimal: "8453",
    factoryAddress: "0x50F43Fc609F1fA87050F40cd1f3D6a37D86575ce",
    presaleFactory: "0x450159dAD95f898ad5b13640445Ef2353D2509d2",
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
