pragma solidity ^0.4.24; //We have to specify what version of compiler this code will use

contract TwoKeyPlasmaEvents {
    // REPLICATE INFO FROM ETHEREUM NETWORK

    // every event we generate contains both the campaign address and the address of the contractor of that campaign
    // both are ethereum address.
    // this plasma contract does not know in itself who is the contractor on the ethereum network
    // instead it receives the contractor address when a method is called and then emits an event with that address
    // a different user can use a dApp that access both ethereum and plasma networks. The dApp first read the correct contractor address from etherum
    // and then the dApp filter only plasma events that contain the correct contractor address. Filtering out any false events that may be generated by
    // a malicous plasma user.
    event Visited(address indexed to, address indexed c, address indexed contractor, address from);  // the to is a plasma address, you should look it up in plasma2ethereum

    // campaign,contractor eth-addr=>user eth-addr=>public key
    // we keep the contractor address for each campaign contract because we dont have access to the ethereum network
    // from inside plama network and we can not read who is the contractor of the campaign.
    // instead we relly on the plasma user to supply this information for us
    // and later we will generate a Visited event that will contain this information.
    mapping(address => mapping(address => mapping(address => address))) public public_link_key;
    // campaign,contractor eth-addr=>user eth-addr=>cut
    // The cut from the bounty each influencer is taking + 1
    // zero (also the default value) indicates default behaviour in which the influencer takes an equal amount as other influencers
    mapping(address => mapping(address => mapping(address => uint256))) public influencer2cut;
    // have a different setPublicLinkKey method that a plasma user can call with a new contract,public_link_key
    // The steps are as follow:
    // 1. make sure you have an ethereum address
    // 2. call add_plasma2ethereum to make a connection between plamsa address (msg.sender) to ethereum address
    // 3. the plasma user pass his ethereum address with the public key used in 2key-link
    //
    function setPublicLinkKey(address c, address contractor, address ethereum_address, address _public_link_key) public {
        // the public key can be set by the plasma user that already proved that she is also the ethereum_address using  add_plasma2ethereum
        require(msg.sender == ethereum_address || plasma2ethereum[msg.sender] == ethereum_address, 'you dont own ethereum_address');
        update_public_link_key(c, contractor, ethereum_address, _public_link_key);
    }

    // plasma address => ethereum address
    // note that more than one plasma address can point to the same ethereum address so it is not critical to use the same plasma address all the time for the same user
    // in some cases the plasma address will be the same as the ethereum address and in that case it is not necessary to have an entry
    // the way to know if an address is a plasma address is to look it up in this mapping
    mapping(address => address) public plasma2ethereum;
    mapping(address => address) public ethereum2plasma;

    // SOCIAL GRAPH

    // campaign,contractor eth-addr=>from eth-addr=>to eth or plasma address=>true/false
    // not that the "to" addrss in an edge of the graph can be either a plasma or an ethereum address
    // the from address is always an ethereum address
    mapping(address => mapping(address => mapping(address => mapping(address => bool)))) public visits;
    // campaign,contractor eth-addr=>to eth or plasma-addr=>from eth-addr=>true/false
    mapping(address => mapping(address => mapping(address => address))) public visited_from;
    // campaign,contractor eth-addr=>from eth-addr=>list of to eth or plasma address.
    mapping(address => mapping(address => mapping(address => address[]))) public visits_list;
// TODO    mapping(address => bytes[]) public sign_list;

    function add_plasma2ethereum(bytes sig, bool with_prefix) public {
        // add an entry connecting msg.sender to the ethereum address that was used to sign sig.
        // see setup_demo.js on how to generate sig
        // with_prefix should be true when using web3.eth.sign/getSign and false when using eth_signTypedData/ecsign
        bytes32 hash = keccak256(abi.encodePacked(keccak256(abi.encodePacked("bytes binding to plasma address")),keccak256(abi.encodePacked(msg.sender))));
        if (with_prefix) {
            bytes memory prefix = "\x19Ethereum Signed Message:\n32";
            hash = keccak256(abi.encodePacked(prefix, hash));
        }

        require (sig.length == 65, 'bad signature length');
        // The signature format is a compact form of:
        //   {bytes32 r}{bytes32 s}{uint8 v}
        // Compact means, uint8 is not padded to 32 bytes.
        uint idx = 32;
        bytes32 r;
        assembly
        {
            r := mload(add(sig, idx))
        }

        idx += 32;
        bytes32 s;
        assembly
        {
            s := mload(add(sig, idx))
        }

        idx += 1;
        uint8 v;
        assembly
        {
            v := mload(add(sig, idx))
        }
        if (v <= 1) v += 27;
        require(v==27 || v==28,'bad sig v');

        address eth_address = ecrecover(hash, v, r, s);
        plasma2ethereum[msg.sender] = eth_address;
        ethereum2plasma[eth_address] = msg.sender;
    }

    function _test_path(address c, address contractor, address to) private returns (bool) {
        while(to != contractor) {
            if(to == address(0)) {
                return false;
            }
            to = visited_from[c][contractor][to];
        }
        return true;
    }

    function test_path(address c, address contractor, address to) private returns (bool) {
        if (_test_path(c, contractor, to)) {
            return true;
        }

        return _test_path(c, contractor,  ethereum2plasma[to]);
    }

    function visited(address c, address contractor, bytes sig) public {
        // c - addresss of the contract on ethereum
        // contractor - is the ethereum address of the contractor who created c. a dApp can read this information for free from ethereum.
        // caller must use the 2key-link and put his plasma address at the end using free_take
        // sig contains the "from" and at the tip of sig you should put your own plasma address (msg.sender)

        // TODO keep table of all 2keylinks of all contracts

        // code bellow should be kept identical to transferSig when using free_take
        uint idx = 0;

        address old_address;
        if (idx+20 <= sig.length) {
            idx += 20;
            assembly
            {
                old_address := mload(add(sig, idx))
            }
        }

        // validate an existing visit path from contractor address to the old_address
        require(test_path(c, contractor, old_address), 'no path to contractor');

        address old_public_link_key = public_link_key[c][contractor][old_address];
        require(old_public_link_key != address(0),'no public link key');

        while (idx + 65 <= sig.length) {
            // The signature format is a compact form of:
            //   {bytes32 r}{bytes32 s}{uint8 v}
            // Compact means, uint8 is not padded to 32 bytes.
            idx += 32;
            bytes32 r;
            assembly
            {
                r := mload(add(sig, idx))
            }

            idx += 32;
            bytes32 s;
            assembly
            {
                s := mload(add(sig, idx))
            }

            idx += 1;
            uint8 v;
            assembly
            {
                v := mload(add(sig, idx))
            }
            if (v <= 1) v += 27;
            require(v==27 || v==28,'bad sig v');

            // idx was increased by 65

            bytes32 hash;
            address new_public_key;
            address new_address;
            if (idx + 41 <= sig.length) {  // its  a < and not a <= because we dont want this to be the final iteration for the converter
                uint8 bounty_cut;
                {
                    idx += 1;
                    assembly
                    {
                        bounty_cut := mload(add(sig, idx))
                    }
                    require(bounty_cut > 0,'bounty/weight not defined (1..255)');
                }

                idx += 20;
                assembly
                {
                    new_address := mload(add(sig, idx))
                }

                idx += 20;
                assembly
                {
                    new_public_key := mload(add(sig, idx))
                }
                update_public_link_key(c, contractor, new_address, new_public_key);
                update_bounty_cut(c, contractor, new_address, bounty_cut);

                hash = keccak256(abi.encodePacked(bounty_cut, new_public_key, new_address));

                // check if we exactly reached the end of the signature. this can only happen if the signature
                // was generated with free_take_join and in this case the last part of the signature must have been
                // generated by the caller of this method
                if (idx == sig.length) {
                    // this does not makes sense when done on plasma because the new_address is a plasma address and all previous address were eth address
                    require(false, 'use free_take and not free_join'); // TODO change to revert()
//                    require(new_address == msg.sender,'only the last in the link can call transferSig');
                }
            } else {
                // handle short signatures generated with free_take
                // signed message for the last step is the address of the converter
                new_address = msg.sender;
                hash = keccak256(abi.encodePacked(new_address));
            }

            // NOTE!!!! for the last user in the sig the  new_address can be a plasma_address
            // as a result the same user with a plasma_address can appear later with an etherum address
            update_visit(c, contractor, old_address, new_address);

            // check if we received a valid signature
            address signer = ecrecover(hash, v, r, s);
            require (signer == old_public_link_key, 'illegal signature');
            old_public_link_key = new_public_key;
            old_address = new_address;
        }
        require(idx == sig.length,'illegal message size');
    }

    function update_public_link_key(address c, address contractor, address new_address, address new_public_key) private {
        // update (only once) the public address used by each influencer
        // we will need this in case one of the influencers will want to start his own off-chain link
        if (public_link_key[c][contractor][new_address] == 0) {
            public_link_key[c][contractor][new_address] = new_public_key;
        } else {
            require(public_link_key[c][contractor][new_address] == new_public_key,'public key can not be modified');
        }
    }

    function update_bounty_cut(address c, address contractor, address new_address, uint8 bounty_cut) private {
        // update (only once) the cut used by each influencer
        // we will need this in case one of the influencers will want to start his own off-chain link
        if (influencer2cut[c][contractor][new_address] == 0) {
            influencer2cut[c][contractor][new_address] = uint256(bounty_cut);
        } else {
            require(influencer2cut[c][contractor][new_address] == uint256(bounty_cut),'bounty cut can not be modified');
        }
    }

    function update_visit(address c, address contractor, address old_address, address new_address) private {
        if (!visits[c][contractor][old_address][new_address]) {  // generate event only once for each tripplet
            visits[c][contractor][old_address][new_address] = true;
            visited_from[c][contractor][new_address] = old_address;
            visits_list[c][contractor][old_address].push(new_address);
            emit Visited(new_address, c, contractor, old_address);
        }
    }

    // return a list of eth/plasma address that came from "from"
    // this method converts address in the list from plasma to ether when possible
    function get_visits_list(address from, address c, address contractor) public view returns (address[]) {
        uint n_influencers = visits_list[c][contractor][from].length;
        if (n_influencers == 0) {
            return visits_list[c][contractor][from];
        }
        address[] memory influencers = new address[](n_influencers);
        for (uint i = 0; i < n_influencers; i++) {
            address influencer = visits_list[c][contractor][from][i];
            if (plasma2ethereum[influencer] != address(0)) {
                influencers[i] = plasma2ethereum[influencer];
            } else {
                influencers[i] = influencer;
            }
        }
        return influencers;
    }
}