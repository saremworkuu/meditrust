const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying MediTrust with account:", deployer.address);

  const MediTrust = await hre.ethers.getContractFactory("MediTrust");
  const mediTrust = await MediTrust.deploy(deployer.address);
  await mediTrust.waitForDeployment();

  const deployedAddress = await mediTrust.getAddress();
  console.log("MediTrust deployed to:", deployedAddress);

  // ABI and address export path for the front-end / viem client
  const outputDir = path.join(__dirname, "..", "src", "contracts");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "MediTrust.sol",
    "MediTrust.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Export ABI
  const abiExportPath = path.join(outputDir, "MediTrustAbi.json");
  fs.writeFileSync(abiExportPath, JSON.stringify(artifact.abi, null, 2));
  console.log("Exported ABI to:", abiExportPath);

  // Export contract address
  const addressExportPath = path.join(outputDir, "addresses.json");
  const addressData = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    mediTrust: deployedAddress,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(addressExportPath, JSON.stringify(addressData, null, 2));
  console.log("Exported addresses to:", addressExportPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
