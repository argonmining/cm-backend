import { RpcClient, Encoding, Resolver, ScriptBuilder, Opcodes, PrivateKey, addressFromScriptPublicKey, createTransactions, kaspaToSompi, UtxoProcessor, UtxoContext } from "../wasm/kaspa/kaspa";
import minimist from 'minimist';

interface TransferOptions {
    privateKey: string;
    dest: string;
    amount?: string;
    network?: string;
    ticker?: string;
    priorityFee?: string;
    timeout?: number;
    logLevel?: string;
}

export async function executeTransfer(options: TransferOptions): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const {
        privateKey: privateKeyArg,
        dest,
        amount = process.env.DEFAULT_CLAIM_AMOUNT || '1333',
        network = process.env.NETWORK || 'mainnet',
        ticker = process.env.CLAIM_TICKER || 'CRUMBS',
        priorityFee = process.env.PRIORITY_FEE || '0.1',
        timeout = process.env.TIMEOUT || 120000,
        logLevel = process.env.LOG_LEVEL || 'INFO'
    } = options;

    let addedEventTrxId: any;
    let SubmittedtrxId: any;
    let eventReceived = false;

    function log(message: string, level: string = 'INFO') {
        const timestamp = new Date().toISOString();
        if (level === 'ERROR') {
            console.error(`[${timestamp}] [${level}] ${message}`);
        } else if (logLevel === 'DEBUG' || level === 'INFO') {
            console.log(`[${timestamp}] [${level}] ${message}`);
        }
    }

    function printResolverUrls(rpcClient: RpcClient) {
        const resolver = rpcClient.resolver;
        if (resolver && resolver.urls) {
            log("Resolver URLs:", 'DEBUG');
            resolver.urls.forEach((url: string) => {
                log(url, 'DEBUG');
            });
        } else {
            log("No URLs found in the Resolver.", 'DEBUG');
        }
    }

    try {
        log("Main: starting rpc connection", 'DEBUG');
        const RPC = new RpcClient({
            resolver: new Resolver(),
            encoding: Encoding.Borsh,
            networkId: network
        });

        await RPC.disconnect();
        await RPC.connect();
        log("Main: RPC connection established", 'DEBUG');

        if (logLevel === 'DEBUG') {
            printResolverUrls(RPC);
        }

        log(`Main: Submitting private key`, 'DEBUG');
        const privateKey = new PrivateKey(privateKeyArg);
        log(`Main: Determining public key`, 'DEBUG');
        const publicKey = privateKey.toPublicKey();
        log(`Main: Determining wallet address`, 'DEBUG');
        const address = publicKey.toAddress(network);
        log(`Address: ${address.toString()}`, 'INFO');

        log(`Subscribing to UTXO changes for address: ${address.toString()}`, 'DEBUG');
        await RPC.subscribeUtxosChanged([address.toString()]);

        RPC.addEventListener('utxos-changed', async (event: any) => {
            log(`UTXO changes detected for address: ${address.toString()}`, 'DEBUG');
            
            const removedEntry = event.data.removed.find((entry: any) => 
                entry.address.payload === address.toString().split(':')[1]
            );
            const addedEntry = event.data.added.find((entry: any) => 
                entry.address.payload === address.toString().split(':')[1]
            );    

            if (removedEntry) {
                log(`Added UTXO found for address: ${address.toString()} with UTXO: ${JSON.stringify(addedEntry, (key, value) =>
                    typeof value === 'bigint' ? value.toString() + 'n' : value)}`, 'DEBUG');        
                log(`Removed UTXO found for address: ${address.toString()} with UTXO: ${JSON.stringify(removedEntry, (key, value) =>
                    typeof value === 'bigint' ? value.toString() + 'n' : value)}`, 'DEBUG');
                addedEventTrxId = addedEntry.outpoint.transactionId;
                log(`Added UTXO TransactionId: ${addedEventTrxId}`,'DEBUG');
                if (addedEventTrxId == SubmittedtrxId){
                    eventReceived = true;
                }
            } else {
                log(`No removed UTXO found for address: ${address.toString()} in this UTXO change event`, 'DEBUG');
            }
        });

        const gasFee = 0.3;
        const data = { "p": "krc-20", "op": "transfer", "tick": ticker, "amt": amount.toString(), "to": dest };

        log(`Main: Data to use for ScriptBuilder: ${JSON.stringify(data)}`, 'DEBUG');

        const script = new ScriptBuilder()
            .addData(publicKey.toXOnlyPublicKey().toString())
            .addOp(Opcodes.OpCheckSig)
            .addOp(Opcodes.OpFalse)
            .addOp(Opcodes.OpIf)
            .addData(Buffer.from("kasplex"))
            .addI64(0n)
            .addData(Buffer.from(JSON.stringify(data, null, 0)))
            .addOp(Opcodes.OpEndIf);

        const P2SHAddress = addressFromScriptPublicKey(script.createPayToScriptHashScript(), network)!;

        if (logLevel === 'DEBUG') {
            log(`Constructed Script: ${script.toString()}`, 'DEBUG');
            log(`P2SH Address: ${P2SHAddress.toString()}`, 'DEBUG');
        }

        const { entries } = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
        const { transactions } = await createTransactions({
            priorityEntries: [],
            entries,
            outputs: [{
                address: P2SHAddress.toString(),
                amount: kaspaToSompi("0.3")!
            }],
            changeAddress: address.toString(),
            priorityFee: kaspaToSompi(priorityFee.toString())!,
            networkId: network
        });

        for (const transaction of transactions) {
            transaction.sign([privateKey]);
            log(`Main: Transaction signed with ID: ${transaction.id}`, 'DEBUG');
            const hash = await transaction.submit(RPC);
            log(`submitted P2SH commit sequence transaction on: ${hash}`, 'INFO');
            SubmittedtrxId = hash;
        }

        // Wait until the maturity event has been received
        while (!eventReceived) {
            await new Promise(resolve => setTimeout(resolve, 500)); // wait and check every 500ms
        }

        if (eventReceived) {
            eventReceived = false;
            log(`Main: creating UTXO entries from ${address.toString()}`, 'DEBUG');
            const { entries } = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });
            log(`Main: creating revealUTXOs from P2SHAddress`, 'DEBUG');
            const revealUTXOs = await RPC.getUtxosByAddresses({ addresses: [P2SHAddress.toString()] });

            log(`Main: Creating Transaction with revealUTX0s entries: ${revealUTXOs.entries[0]}`, 'DEBUG');

            const { transactions } = await createTransactions({
                priorityEntries: [revealUTXOs.entries[0]],
                entries: entries,
                outputs: [],
                changeAddress: address.toString(),
                priorityFee: kaspaToSompi(gasFee.toString())!,
                networkId: network
            });

            let revealHash: any;

            for (const transaction of transactions) {
                transaction.sign([privateKey], false);
                log(`Main: Transaction with revealUTX0s signed with ID: ${transaction.id}`, 'DEBUG');
                const ourOutput = transaction.transaction.inputs.findIndex((input) => input.signatureScript === '');

                if (ourOutput !== -1) {
                    const signature = await transaction.createInputSignature(ourOutput, privateKey);
                    transaction.fillInput(ourOutput, script.encodePayToScriptHashSignatureScript(signature));
                }
                revealHash = await transaction.submit(RPC);
                log(`submitted reveal tx sequence transaction: ${revealHash}`, 'INFO');
                SubmittedtrxId = revealHash;
            }

            // Wait until the maturity event has been received
            while (!eventReceived) {
                await new Promise(resolve => setTimeout(resolve, 500)); // wait and check every 500ms
            }

            try {
                // Fetch the updated UTXOs
                const updatedUTXOs = await RPC.getUtxosByAddresses({ addresses: [address.toString()] });

                // Check if the reveal transaction is accepted
                const revealAccepted = updatedUTXOs.entries.some(entry => {
                    const transactionId = entry.entry.outpoint ? entry.entry.outpoint.transactionId : undefined;
                    return transactionId === revealHash;
                });

                // If reveal transaction is accepted
                if (revealAccepted) {
                    log(`Reveal transaction has been accepted: ${revealHash}`, 'INFO');
                    await RPC.disconnect();
                    log('RPC client disconnected.', 'INFO');
                    return { success: true, txHash: revealHash };
                } else if (!eventReceived) {
                    log('Reveal transaction has not been accepted yet.', 'INFO');
                    return { success: false, error: 'Reveal transaction not accepted' };
                }
            } catch (error) {
                log(`Error checking reveal transaction status: ${error}`, 'ERROR');
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
            }
        }

        return { success: false, error: 'No UTXOs available for reveal' };
    } catch (error) {
        log(`Error in transfer process: ${error}`, 'ERROR');
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
}

// If this file is run directly (not imported), execute the transfer with command line arguments
if (require.main === module) {
    const args = minimist(process.argv.slice(2));
    
    if (!args.privKey || !args.dest) {
        console.error("Please provide a private key using the --privKey flag and the destination with --dest.");
        process.exit(1);
    }

    executeTransfer({
        privateKey: args.privKey,
        dest: args.dest,
        amount: args.amount,
        network: args.network,
        ticker: args.ticker,
        priorityFee: args.priorityFee,
        timeout: args.timeout,
        logLevel: args.logLevel
    }).then(result => {
        if (!result.success) {
            console.error(result.error);
            process.exit(1);
        }
        process.exit(0);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}
    

  