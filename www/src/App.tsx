import React, {useState, useEffect} from 'react';
import logo from './logo.svg';
import './App.css';
import { SigningCosmWasmClient } from 'secretjs';
import ViewKeyButton from "./Containers/ViewKeyButton"
import PairsAvailable from "./Containers/PairsAvailable"
import 'bootstrap/dist/css/bootstrap.min.css';

const AMM_FACTORY_ADDRESS="secret1d3de9fsj0m6jkju94sc8yzecw7f6tfklydrwvc"
const ORDERS_FACTORY_ADDRESS="secret1lrw7twt6n427hv9ke7fk245s9qmwyjstk7ene8" 
 
function App() {
  const [client, setClient] = useState({
    ready: false,
    execute: null,
    accountData: {
      address: ""
    }
  });

  const [viewKey, setViewKey] = useState({
    ready: false,
    value: null
  });

  useEffect(() => {
    setupKeplr(setClient)
  }, [])

  if(!client.ready) {
    return <div>Loading...</div>
  } else {
    return (
      <div className="App">
          <ViewKeyButton 
            ORDERS_FACTORY_ADDRESS={ORDERS_FACTORY_ADDRESS}
            client={client}
            viewKey={viewKey}
            setViewKey={setViewKey}
          />
          <PairsAvailable 
            AMM_FACTORY_ADDRESS={AMM_FACTORY_ADDRESS}
            ORDERS_FACTORY_ADDRESS={ORDERS_FACTORY_ADDRESS}
            client={client}
            viewKey={viewKey.value}
          />
      </div>
    );
  }
}

export default App;


const setupKeplr = async (setClient: any) => {
  // Define sleep
  const CHAIN_ID = "holodeck-2";
  
  const sleep = (ms: number) => new Promise((accept) => setTimeout(accept, ms));

  // Wait for Keplr to be injected to the page
  while (
    !window.keplr &&
    !window.getOfflineSigner &&
    !window.getEnigmaUtils
  ) {
    await sleep(10);
  }

  // Use a custom chain with Keplr.
  // On mainnet we don't need this (`experimentalSuggestChain`).
  // This works well with `enigmampc/secret-network-sw-dev`:
  //     - https://hub.docker.com/r/enigmampc/secret-network-sw-dev
  //     - Run a local chain: `docker run -it --rm -p 26657:26657 -p 26656:26656 -p 1337:1337 -v $(shell pwd):/root/code --name secretdev enigmampc/secret-network-sw-dev`
  //     - `alias secretcli='docker exec -it secretdev secretcli'`
  //     - Store a contract: `docker exec -it secretdev secretcli tx compute store /root/code/contract.wasm.gz --from a --gas 10000000 -b block -y`
  // On holodeck, set:
  //     1. CHAIN_ID = "holodeck-2"
  //     2. rpc = "ttp://bootstrap.secrettestnet.io:26657"
  //     3. rest = "https://bootstrap.secrettestnet.io"
  //     4. chainName = Whatever you like
  // For more examples, go to: https://github.com/chainapsis/keplr-example/blob/master/src/main.js
  await window.keplr.experimentalSuggestChain({
    chainId: CHAIN_ID,
    chainName: "Local Secret Chain",
    rpc: "http://bootstrap.secrettestnet.io:26657",
    rest: "https://bootstrap.secrettestnet.io",
    bip44: {
      coinType: 529,
    },
    coinType: 529,
    stakeCurrency: {
      coinDenom: "SCRT",
      coinMinimalDenom: "uscrt",
      coinDecimals: 6,
    },
    bech32Config: {
      bech32PrefixAccAddr: "secret",
      bech32PrefixAccPub: "secretpub",
      bech32PrefixValAddr: "secretvaloper",
      bech32PrefixValPub: "secretvaloperpub",
      bech32PrefixConsAddr: "secretvalcons",
      bech32PrefixConsPub: "secretvalconspub",
    },
    currencies: [
      {
        coinDenom: "SCRT",
        coinMinimalDenom: "uscrt",
        coinDecimals: 6,
      },
    ],
    feeCurrencies: [
      {
        coinDenom: "SCRT",
        coinMinimalDenom: "uscrt",
        coinDecimals: 6,
      },
    ],
    gasPriceStep: {
      low: 0.3,
      average: 0.45,
      high: 0.6,
    },
    features: ["secretwasm"],
  });

  // Enable Keplr.
  // This pops-up a window for the user to allow keplr access to the webpage.
  await window.keplr.enable(CHAIN_ID);

  // Setup SecrtJS with Keplr's OfflineSigner
  // This pops-up a window for the user to sign on each tx we sent
  const keplrOfflineSigner = window.getOfflineSigner(CHAIN_ID);
  const accounts = await keplrOfflineSigner.getAccounts();

  const execute = await new SigningCosmWasmClient(
    "https://bootstrap.secrettestnet.io", // holodeck - https://bootstrap.secrettestnet.io; mainnet - user your LCD/REST provider
    accounts[0].address,
    window.getOfflineSigner(CHAIN_ID),
    window.getEnigmaUtils(CHAIN_ID),
    {
      // 300k - Max gas units we're willing to use for init
      init: {
        amount: [{ amount: "500000", denom: "uscrt" }],
        gas: "500000",
      },
      // 300k - Max gas units we're willing to use for exec
      exec: {
        amount: [{ amount: "500000", denom: "uscrt" }],
        gas: "500000",
      },
    }
  )

  const accountData = await execute.getAccount(accounts[0].address);
  
  setClient({
    ready: true,
    execute,
    accountData
  })
}

declare global {
  interface Window { keplr: any, getOfflineSigner:any, getEnigmaUtils:any }
}