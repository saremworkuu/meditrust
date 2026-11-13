import mediTrustAbiJson from './MediTrustAbi.json';
import addressesJson from './addresses.json';

export const mediTrustAbi = mediTrustAbiJson;
export const contractAddresses = addressesJson;
export const MEDITRUST_CONTRACT_ADDRESS = addressesJson.mediTrust as `0x${string}`;
