/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumberish,
  BytesLike,
  FunctionFragment,
  Result,
  Interface,
  EventFragment,
  AddressLike,
  ContractRunner,
  ContractMethod,
  Listener,
} from "ethers";
import type {
  TypedContractEvent,
  TypedDeferredTopicFilter,
  TypedEventLog,
  TypedLogDescription,
  TypedListener,
  TypedContractMethod,
} from "../../common";

export interface PresaleLockInterface extends Interface {
  getFunction(
    nameOrSignature:
      | "BPS_FACTOR"
      | "OTTERPAD_DAO"
      | "OTTERPAD_FEE_BPS"
      | "cancelDeposit"
      | "checkIfTxHashHasDeposits"
      | "collectTokensAsFounders"
      | "deposit"
      | "depositCounter"
      | "deposits"
      | "foundersWallet"
      | "getERC20TokenBalance"
      | "getSaleTokenBalance"
      | "getUserDepositIds"
      | "otterpadFund"
      | "redeem"
      | "saleToken"
      | "setFundraiser"
      | "title"
      | "txHashToDepositIds"
      | "userDepositIds"
  ): FunctionFragment;

  getEvent(
    nameOrSignatureOrTopic:
      | "CollectTokens"
      | "DepositCanceled"
      | "DepositLocked"
      | "RedeemUnlocked"
  ): EventFragment;

  encodeFunctionData(
    functionFragment: "BPS_FACTOR",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "OTTERPAD_DAO",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "OTTERPAD_FEE_BPS",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "cancelDeposit",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "checkIfTxHashHasDeposits",
    values: [BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "collectTokensAsFounders",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "deposit",
    values: [BigNumberish, AddressLike, BigNumberish, BytesLike]
  ): string;
  encodeFunctionData(
    functionFragment: "depositCounter",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "deposits",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "foundersWallet",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getERC20TokenBalance",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "getSaleTokenBalance",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getUserDepositIds",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "otterpadFund",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "redeem",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(functionFragment: "saleToken", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "setFundraiser",
    values: [AddressLike]
  ): string;
  encodeFunctionData(functionFragment: "title", values?: undefined): string;
  encodeFunctionData(
    functionFragment: "txHashToDepositIds",
    values: [BytesLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "userDepositIds",
    values: [AddressLike, BigNumberish]
  ): string;

  decodeFunctionResult(functionFragment: "BPS_FACTOR", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "OTTERPAD_DAO",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "OTTERPAD_FEE_BPS",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "cancelDeposit",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "checkIfTxHashHasDeposits",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "collectTokensAsFounders",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "deposit", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "depositCounter",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "deposits", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "foundersWallet",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getERC20TokenBalance",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getSaleTokenBalance",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getUserDepositIds",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "otterpadFund",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "redeem", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "saleToken", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "setFundraiser",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "title", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "txHashToDepositIds",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "userDepositIds",
    data: BytesLike
  ): Result;
}

export namespace CollectTokensEvent {
  export type InputTuple = [
    tokenAddress: AddressLike,
    recipient: AddressLike,
    amount: BigNumberish,
    feeAmount: BigNumberish,
    timestamp: BigNumberish
  ];
  export type OutputTuple = [
    tokenAddress: string,
    recipient: string,
    amount: bigint,
    feeAmount: bigint,
    timestamp: bigint
  ];
  export interface OutputObject {
    tokenAddress: string;
    recipient: string;
    amount: bigint;
    feeAmount: bigint;
    timestamp: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace DepositCanceledEvent {
  export type InputTuple = [
    depositId: BigNumberish,
    recipient: AddressLike,
    amount: BigNumberish,
    timestamp: BigNumberish
  ];
  export type OutputTuple = [
    depositId: bigint,
    recipient: string,
    amount: bigint,
    timestamp: bigint
  ];
  export interface OutputObject {
    depositId: bigint;
    recipient: string;
    amount: bigint;
    timestamp: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace DepositLockedEvent {
  export type InputTuple = [
    depositId: BigNumberish,
    recipient: AddressLike,
    amount: BigNumberish,
    unlockUnixTime: BigNumberish,
    blockNumber: BigNumberish,
    timestamp: BigNumberish,
    txHash: BytesLike
  ];
  export type OutputTuple = [
    depositId: bigint,
    recipient: string,
    amount: bigint,
    unlockUnixTime: bigint,
    blockNumber: bigint,
    timestamp: bigint,
    txHash: string
  ];
  export interface OutputObject {
    depositId: bigint;
    recipient: string;
    amount: bigint;
    unlockUnixTime: bigint;
    blockNumber: bigint;
    timestamp: bigint;
    txHash: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace RedeemUnlockedEvent {
  export type InputTuple = [
    depositId: BigNumberish,
    recipient: AddressLike,
    amount: BigNumberish,
    timestamp: BigNumberish
  ];
  export type OutputTuple = [
    depositId: bigint,
    recipient: string,
    amount: bigint,
    timestamp: bigint
  ];
  export interface OutputObject {
    depositId: bigint;
    recipient: string;
    amount: bigint;
    timestamp: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export interface PresaleLock extends BaseContract {
  connect(runner?: ContractRunner | null): PresaleLock;
  waitForDeployment(): Promise<this>;

  interface: PresaleLockInterface;

  queryFilter<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;
  queryFilter<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;

  on<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  on<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  once<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  once<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  listeners<TCEvent extends TypedContractEvent>(
    event: TCEvent
  ): Promise<Array<TypedListener<TCEvent>>>;
  listeners(eventName?: string): Promise<Array<Listener>>;
  removeAllListeners<TCEvent extends TypedContractEvent>(
    event?: TCEvent
  ): Promise<this>;

  BPS_FACTOR: TypedContractMethod<[], [bigint], "view">;

  OTTERPAD_DAO: TypedContractMethod<[], [string], "view">;

  OTTERPAD_FEE_BPS: TypedContractMethod<[], [bigint], "view">;

  cancelDeposit: TypedContractMethod<
    [depositId: BigNumberish],
    [void],
    "nonpayable"
  >;

  checkIfTxHashHasDeposits: TypedContractMethod<
    [txHash: BytesLike],
    [bigint[]],
    "view"
  >;

  collectTokensAsFounders: TypedContractMethod<
    [tokenAddress: AddressLike],
    [void],
    "nonpayable"
  >;

  deposit: TypedContractMethod<
    [
      amount: BigNumberish,
      recipient: AddressLike,
      unlockUnixTime: BigNumberish,
      txHash: BytesLike
    ],
    [void],
    "nonpayable"
  >;

  depositCounter: TypedContractMethod<[], [bigint], "view">;

  deposits: TypedContractMethod<
    [arg0: BigNumberish],
    [
      [string, bigint, bigint, bigint, boolean, boolean, string] & {
        recipient: string;
        amount: bigint;
        unlockUnixTime: bigint;
        depositId: bigint;
        isRedeemed: boolean;
        isCanceled: boolean;
        txHash: string;
      }
    ],
    "view"
  >;

  foundersWallet: TypedContractMethod<[], [string], "view">;

  getERC20TokenBalance: TypedContractMethod<
    [tokenAddress: AddressLike],
    [bigint],
    "view"
  >;

  getSaleTokenBalance: TypedContractMethod<[], [bigint], "view">;

  getUserDepositIds: TypedContractMethod<
    [user: AddressLike],
    [bigint[]],
    "view"
  >;

  otterpadFund: TypedContractMethod<[], [string], "view">;

  redeem: TypedContractMethod<[depositId: BigNumberish], [void], "nonpayable">;

  saleToken: TypedContractMethod<[], [string], "view">;

  setFundraiser: TypedContractMethod<
    [_otterpadFund: AddressLike],
    [void],
    "nonpayable"
  >;

  title: TypedContractMethod<[], [string], "view">;

  txHashToDepositIds: TypedContractMethod<
    [arg0: BytesLike, arg1: BigNumberish],
    [bigint],
    "view"
  >;

  userDepositIds: TypedContractMethod<
    [arg0: AddressLike, arg1: BigNumberish],
    [bigint],
    "view"
  >;

  getFunction<T extends ContractMethod = ContractMethod>(
    key: string | FunctionFragment
  ): T;

  getFunction(
    nameOrSignature: "BPS_FACTOR"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "OTTERPAD_DAO"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "OTTERPAD_FEE_BPS"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "cancelDeposit"
  ): TypedContractMethod<[depositId: BigNumberish], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "checkIfTxHashHasDeposits"
  ): TypedContractMethod<[txHash: BytesLike], [bigint[]], "view">;
  getFunction(
    nameOrSignature: "collectTokensAsFounders"
  ): TypedContractMethod<[tokenAddress: AddressLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "deposit"
  ): TypedContractMethod<
    [
      amount: BigNumberish,
      recipient: AddressLike,
      unlockUnixTime: BigNumberish,
      txHash: BytesLike
    ],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "depositCounter"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "deposits"
  ): TypedContractMethod<
    [arg0: BigNumberish],
    [
      [string, bigint, bigint, bigint, boolean, boolean, string] & {
        recipient: string;
        amount: bigint;
        unlockUnixTime: bigint;
        depositId: bigint;
        isRedeemed: boolean;
        isCanceled: boolean;
        txHash: string;
      }
    ],
    "view"
  >;
  getFunction(
    nameOrSignature: "foundersWallet"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "getERC20TokenBalance"
  ): TypedContractMethod<[tokenAddress: AddressLike], [bigint], "view">;
  getFunction(
    nameOrSignature: "getSaleTokenBalance"
  ): TypedContractMethod<[], [bigint], "view">;
  getFunction(
    nameOrSignature: "getUserDepositIds"
  ): TypedContractMethod<[user: AddressLike], [bigint[]], "view">;
  getFunction(
    nameOrSignature: "otterpadFund"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "redeem"
  ): TypedContractMethod<[depositId: BigNumberish], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "saleToken"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "setFundraiser"
  ): TypedContractMethod<[_otterpadFund: AddressLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "title"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "txHashToDepositIds"
  ): TypedContractMethod<
    [arg0: BytesLike, arg1: BigNumberish],
    [bigint],
    "view"
  >;
  getFunction(
    nameOrSignature: "userDepositIds"
  ): TypedContractMethod<
    [arg0: AddressLike, arg1: BigNumberish],
    [bigint],
    "view"
  >;

  getEvent(
    key: "CollectTokens"
  ): TypedContractEvent<
    CollectTokensEvent.InputTuple,
    CollectTokensEvent.OutputTuple,
    CollectTokensEvent.OutputObject
  >;
  getEvent(
    key: "DepositCanceled"
  ): TypedContractEvent<
    DepositCanceledEvent.InputTuple,
    DepositCanceledEvent.OutputTuple,
    DepositCanceledEvent.OutputObject
  >;
  getEvent(
    key: "DepositLocked"
  ): TypedContractEvent<
    DepositLockedEvent.InputTuple,
    DepositLockedEvent.OutputTuple,
    DepositLockedEvent.OutputObject
  >;
  getEvent(
    key: "RedeemUnlocked"
  ): TypedContractEvent<
    RedeemUnlockedEvent.InputTuple,
    RedeemUnlockedEvent.OutputTuple,
    RedeemUnlockedEvent.OutputObject
  >;

  filters: {
    "CollectTokens(address,address,uint256,uint256,uint256)": TypedContractEvent<
      CollectTokensEvent.InputTuple,
      CollectTokensEvent.OutputTuple,
      CollectTokensEvent.OutputObject
    >;
    CollectTokens: TypedContractEvent<
      CollectTokensEvent.InputTuple,
      CollectTokensEvent.OutputTuple,
      CollectTokensEvent.OutputObject
    >;

    "DepositCanceled(uint256,address,uint256,uint256)": TypedContractEvent<
      DepositCanceledEvent.InputTuple,
      DepositCanceledEvent.OutputTuple,
      DepositCanceledEvent.OutputObject
    >;
    DepositCanceled: TypedContractEvent<
      DepositCanceledEvent.InputTuple,
      DepositCanceledEvent.OutputTuple,
      DepositCanceledEvent.OutputObject
    >;

    "DepositLocked(uint256,address,uint256,uint256,uint256,uint256,bytes32)": TypedContractEvent<
      DepositLockedEvent.InputTuple,
      DepositLockedEvent.OutputTuple,
      DepositLockedEvent.OutputObject
    >;
    DepositLocked: TypedContractEvent<
      DepositLockedEvent.InputTuple,
      DepositLockedEvent.OutputTuple,
      DepositLockedEvent.OutputObject
    >;

    "RedeemUnlocked(uint256,address,uint256,uint256)": TypedContractEvent<
      RedeemUnlockedEvent.InputTuple,
      RedeemUnlockedEvent.OutputTuple,
      RedeemUnlockedEvent.OutputObject
    >;
    RedeemUnlocked: TypedContractEvent<
      RedeemUnlockedEvent.InputTuple,
      RedeemUnlockedEvent.OutputTuple,
      RedeemUnlockedEvent.OutputObject
    >;
  };
}
