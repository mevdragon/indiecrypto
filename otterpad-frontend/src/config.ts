// src/config/chains.ts
export interface ChainConfig {
  chain: string;
  chainIdDecimal: string;
  factoryAddress: string;
  isDisabled: boolean;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    chain: "Sepolia Testnet",
    chainIdDecimal: "11155111",
    factoryAddress: "0xf56759Df56bA0fe7294c75715E8eD2d2b065577F",
    isDisabled: false,
  },
  {
    chain: "Base Mainnet",
    chainIdDecimal: "8453",
    factoryAddress: "", // To be filled
    isDisabled: true,
  },
];

export const getFactoryAddress = (chainId: string): string => {
  const chain = SUPPORTED_CHAINS.find((c) => c.chainIdDecimal === chainId);
  if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
  return chain.factoryAddress;
};
