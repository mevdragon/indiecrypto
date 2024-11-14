/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Interface, type ContractRunner } from "ethers";
import type {
  IOtterpadFund,
  IOtterpadFundInterface,
} from "../../../contracts/PresaleLock.sol/IOtterpadFund";

const _abi = [
  {
    inputs: [],
    name: "isDeployedToUniswap",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "saleToken",
    outputs: [
      {
        internalType: "contract IERC20",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export class IOtterpadFund__factory {
  static readonly abi = _abi;
  static createInterface(): IOtterpadFundInterface {
    return new Interface(_abi) as IOtterpadFundInterface;
  }
  static connect(
    address: string,
    runner?: ContractRunner | null
  ): IOtterpadFund {
    return new Contract(address, _abi, runner) as unknown as IOtterpadFund;
  }
}