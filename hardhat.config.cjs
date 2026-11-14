require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });
require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
const privateKey = process.env.PRIVATE_KEY;
const targetChainId = process.env.NEXT_PUBLIC_CHAIN_ID ? parseInt(process.env.NEXT_PUBLIC_CHAIN_ID, 10) : 31337;

// Format account array safely without committing keys
const accounts =
  privateKey && !privateKey.includes("your_") && privateKey.length >= 64
    ? [privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`]
    : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    targetNetwork: {
      url: rpcUrl,
      chainId: targetChainId,
      accounts: accounts.length > 0 ? accounts : undefined,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
