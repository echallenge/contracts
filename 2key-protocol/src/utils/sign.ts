import eth_util from 'ethereumjs-util';
import assert from 'assert';
import crypto from 'crypto';
import sigUtil from 'eth-sig-util';
import {IOffchainSignedKeypair} from '../interfaces';

function generatePrivateKey(): Buffer {
    return crypto.randomBytes(32)
}

function privateToPublic(private_key: Buffer) {
    // convert a private_key buffer to a public address string
    // @ts-ignore: Missing declaration of publicToAddress in ethereumjs-util
    return eth_util.publicToAddress(eth_util.privateToPublic(private_key)).toString('hex');
}

function free_take(my_address: string, f_address: string, f_secret?: string, p_message?: string) {
    // using information in the signed link (f_address,f_secret,p_message)
    // return a new message that can be passed to the transferSig method of the contract
    // to move ARCs arround in the current. For example:
    //   campaign_contract.transferSig(free_take (my_address,f_address,f_secret,p_message))
    //
    // my_address - I'm a new influencer or a converter
    // f_address - previous influencer
    // f_secret - the secret of the parent (contractor or previous influencer) is passed in the 2key link
    // p_message - the message built by previous influencers
    const old_private_key = Buffer.from(f_secret, 'hex');
    if (!eth_util.isValidPrivate(old_private_key)) {
        throw new Error('old private key not valid');
    }

    let m;
    // let prefix = "00"  // not reall important because it only used when receiving a free link directly from the contractor
    if (p_message) { // the message built by previous influencers
        m = p_message + f_address.slice(2);
        const old_public_address = privateToPublic(old_private_key);
        m += old_public_address;
    } else {
        // this happens when receiving a free link directly from the contractor
        // m = prefix + f_address.slice(2)
        m = f_address.slice(2);
    }

    // the message we want to sign is my address (I'm the converter)
    // and we will sign with the private key from the previous step (contractor or influencer)
    // this will prove that I (my address) knew what the previous private key was
    const msg = Buffer.from(my_address.slice(2), 'hex'); // skip 0x
    const msgHash = eth_util.sha3(msg);
    let sig = eth_util.ecsign(msgHash, old_private_key);
    assert.ok(sig.v === 27 || sig.v === 28, 'unknown sig.v');

    sig = Buffer.concat([sig.r, sig.s, Buffer.from([sig.v])]);

    // TODO: Fix this
    // @ts-ignore: custom toString() implementation
    m += sig.toString('hex');
    m = `0x${m}`;
    return m;
}

function free_join(my_address: string, public_address: string, f_address: string, f_secret: string, p_message: string, rCut: number): string {
    // let cut = fcut;
    // Input:
    //   my_address - I'm an influencer that wants to generate my own link
    //   public_address - the public address of my private key
    // return - my new message

    // the message we want to sign is my address (I'm the influencer or converter)
    // and the public key of the private key which I will put in the link
    // and we will sign all of this with the private key from the previous step,
    // this will prove that I (my address) knew what the previous private key was
    // and it will link the new private/public key to the previous keys to form a path
    const msg0 = Buffer.from(public_address, 'hex');
    const msg1 = Buffer.from(my_address.slice(2), 'hex'); // skip 0x
    let msg = Buffer.concat([msg0, msg1]); // compact msg (as is done in sha3 inside solidity)
    // if not using version prefix to the message:
    let cut: any = rCut;
    if (cut == null) {
        cut = 255; // equal partition
    }
    cut = Buffer.from([cut]);
    msg = Buffer.concat([cut, msg]); // compact msg (as is done in sha3 inside solidity)
    const msgHash = eth_util.sha3(msg);
    const old_private_key = Buffer.from(f_secret, 'hex');
    let sig = eth_util.ecsign(msgHash, old_private_key);

    // check the signature
    // this is what the contract will do
    let recovered_address = eth_util.ecrecover(msgHash, sig.v, sig.r, sig.s);
    // @ts-ignore: Missing declaration of publicToAddress in ethereumjs-util
    recovered_address = eth_util.publicToAddress(recovered_address).toString('hex');
    const old_public_address = privateToPublic(old_private_key);
    assert.equal(recovered_address, old_public_address, 'sig failed');

    sig = Buffer.concat([sig.r, sig.s, Buffer.from([sig.v])]);
    let m: Buffer | string = Buffer.concat([sig, cut]);
    m = m.toString('hex');

    if (p_message) {
        m = p_message + f_address.slice(2) + old_public_address + m;
    } else {
        // this happens when receiving a free link directly from the contractor
        m = f_address.slice(2) + m;
    }
    return m;
}

function free_join_take(my_address: string, public_address: string, f_address: string, f_secret: string, p_message: string, cut?: number): string {
    // using information in the signed link (f_address,f_secret,p_message)
    // return a new message that can be passed to the transferSig method of the contract
    // to move ARCs arround in the current. For example:
    //   campaign_contract.transferSig(free_take (my_address,f_address,f_secret,p_message))
    // unlike free_take, this function will give information to transferSig so in the future, if I want,
    // I can also become an influencer
    //
    // my_address - I'm a new influencer or a converter
    // public_address - the public key of my secret that I will put in a link that I will generate
    // f_address - previous influencer
    // f_secret - the secret of the parent (contractor or previous influencer) is passed in the 2key link
    // p_message - the message built by previous influencers
    // cut - this should be a number between 0 and 255.
    //   value from 1 to 101 are translated to percentage in the contract by removing 1.
    //   all other values are used to say use default behaviour
    let m = free_join(my_address, public_address, f_address, f_secret, p_message, cut);
    m += my_address.slice(2) + public_address;
    return `0x${m}`;
}

function validate_join(firtsPublicKey: string, f_address: string, f_secret: string, pMessage: string): number[] {
    console.log('Validate join', firtsPublicKey, f_address, f_secret, pMessage);
    let first_public_key: any = firtsPublicKey;
    let p_message = pMessage;
    const bounty_cuts = [];
    // Validate a link (f_address, f_secret, p_message) that was generated by free_join.
    // this is similar to the  validation that is done inside the transferSig method of the TwoKeySignedContract contract
    // without the last step in which the converter is verified
    //
    // Input:
    //   first_public_key - the public key of the contractor or of the first influencer in the link.
    //     you can read it from the campaign contract.
    //     For example, with this code:
    //      let first_address = p_message ? (p_message.startsWith('0x') ? p_message.slice(2,42) : p_message.slice(0,40)) : f_address
    //      // TwoKeyContract_instance is the web3 object representing the contract
    //      TwoKeyContract_instance.public_link_key(first_address), first_public_key => {...})

    const last_private_key = Buffer.from(f_secret, 'hex');
    assert.ok(eth_util.isValidPrivate(last_private_key), 'last private key not valid');
    const last_public_key = privateToPublic(last_private_key);

    if (first_public_key.startsWith('0x')) {
        first_public_key = first_public_key.slice(2);
    }
    if (!p_message) {
        assert.ok(first_public_key === last_public_key, 'keys dont match');
        return bounty_cuts;
    }

    // p_message ends with the bounty_cut for f_address
    p_message += f_address.slice(2);
    p_message += last_public_key;

    if (p_message.startsWith('0x')) {
        p_message = p_message.slice(2);
    }

    // get the first address in the path (contractor or first influencer)
    assert.ok(p_message.length >= 2 * 20, 'message length too short');
    // let old_address = p_message.slice(0, 2 * 20);
    p_message = p_message.slice(2 * 20);

    // loop through all the steps of the path
    while (p_message.length >= 2 * (65 + 41)) {
        // not having the last 41 bytes can happen only for last step of a converter
        // read signature
        let r: any = p_message.slice(0, 32 * 2);
        r = Buffer.from(r, 'hex');
        p_message = p_message.slice(32 * 2);
        let s: any = p_message.slice(0, 32 * 2);
        s = Buffer.from(s, 'hex');
        p_message = p_message.slice(32 * 2);
        let v: any = p_message.slice(0, 1 * 2);

        v = Buffer.from(p_message.slice(0, 1 * 2), 'hex')[0];
        assert.ok(v === 27 || v === 28, 'unknown sig.v');
        p_message = p_message.slice(1 * 2);

        let bounty_cut: any = p_message.slice(0, 1 * 2);
        p_message = p_message.slice(1 * 2);
        bounty_cut = Buffer.from(bounty_cut, 'hex');
        assert.ok(bounty_cut[0] !== 0, 'cut=0, use 255 for equal parts');
        bounty_cuts.push(bounty_cut[0]);

        let new_address: any = p_message.slice(0, 20 * 2);
        p_message = p_message.slice(20 * 2);
        new_address = Buffer.from(new_address, 'hex');

        let new_public_key: any = p_message.slice(0, 20 * 2);
        p_message = p_message.slice(20 * 2);
        new_public_key = Buffer.from(new_public_key, 'hex');

        let hash: Buffer | Uint8Array = Buffer.concat([bounty_cut, new_public_key, new_address]);
        hash = eth_util.sha3(hash);

        let recovered_address = eth_util.ecrecover(hash, v, r, s);
        // @ts-ignore: Missing declaration of publicToAddress in ethereumjs-util
        recovered_address = eth_util.publicToAddress(recovered_address).toString('hex');
        assert.ok(first_public_key == recovered_address, 'signature failed');

        // old_address = new_address;
        first_public_key = new_public_key.toString('hex');
    }
    assert.ok(p_message.length === 0, 'bad message length');

    return bounty_cuts;
}

function getSignedKeys(web3: any, campaignAddress: string, my_address: string): IOffchainSignedKeypair {
    let i = 1;
    let ii = i.toString(16);
    let msg = '0xdeadbeef' + campaignAddress.slice(2) + my_address.slice(2) + ii;
    let private_key: string;
    // if (plasma_address) {
    //     let msgParams = [
    //         {
    //             type: 'bytes',      // Any valid solidity type
    //             name: 'binding to plasma address',     // Any string label you want
    //             value: plasma_address  // The value to sign
    //         }
    //     ]
    //     web3.currentProvider.sendAsync({
    //         method: 'eth_signTypedData',
    //         params: [msgParams, my_address],
    //         from: my_address,
    //     }, (err, res) => {
    //         if (err) {
    //             reject(err);
    //         } else {
    //             const sig = (typeof res == 'string') ? res : res.result;
    //             let recovered = sigUtil.recoverTypedSignature({
    //                 data: msgParams,
    //                 sig,
    //             })
    //         }
    //     });
    //
    // } else {
    msg = web3.sha3(msg);
    private_key = web3.sha3(web3.eth.sign(my_address, msg));
    private_key = private_key.slice(2, 2 + 32 * 2);
    // }
    return {
        private_key,
        public_address: privateToPublic(Buffer.from(private_key, 'hex')),
    };
}

export default {
    free_take,
    free_join,
    free_join_take,
    privateToPublic,
    validate_join,
    generatePrivateKey,
    getSignedKeys,
};
