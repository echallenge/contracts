pragma solidity ^0.4.24;

import "../campaign-mutual-contracts/TwoKeyPlasmaCampaign.sol";
import "../libraries/MerkleProof.sol";
import "../libraries/IncentiveModels.sol";
import "../upgradable-pattern-campaigns/UpgradeableCampaign.sol";
import "../TwoKeyConversionStates.sol";


contract TwoKeyCPCCampaignPlasma is UpgradeableCampaign, TwoKeyPlasmaCampaign, TwoKeyConversionStates {

    uint totalBountyForCampaign; //total 2key tokens amount staked for the campaign
    uint bountyPerConversionWei; //amount of 2key tokens which are going to be paid per conversion

    uint public maxNumberOfConversions;
    uint numberOfExecutedConversions;

    mapping(address => uint256) public referrerPlasma2TotalEarnings2key; // Total earnings for referrers
    mapping(address => uint256) public referrerPlasmaAddressToCounterOfConversions; // [referrer][conversionId]
    mapping(address => mapping(uint256 => uint256)) internal referrerPlasma2EarningsPerConversion;

    uint constant public N = 2048;

    IncentiveModel model;

    string public targetUrl;
    address public mirrorCampaignOnPublic; // Address of campaign deployed to public eth network


    //Active influencer means that he has at least on participation in successful conversion
    address[] public activeInfluencers;
    mapping(address => bool) isActiveInfluencer;
    mapping(address => uint) activeInfluencer2idx;

    mapping(address => bool) isConverter;
    mapping(address => bool) isApprovedConverter;

    bytes32 public merkleRoot;
    bytes32[] merkle_roots;


    struct Conversion {
        address converterPlasma;
        uint bountyPaid;
        uint conversionTimestamp;
        ConversionState state;
    }

    Conversion [] conversions;

    mapping(address => uint) converterToConversionId;

    function setInitialParamsCPCCampaignPlasma(
        address _twoKeyPlasmaSingletonRegistry,
        address _contractor,
        address _moderator,
        string _url,
        uint [] numberValues
    )
    public
    {
        require(isCampaignInitialized == false);

        TWO_KEY_SINGLETON_REGISTRY = _twoKeyPlasmaSingletonRegistry;
        contractor = _contractor;
        moderator = _moderator;
        targetUrl = _url; // Set the contractor of the campaign

        campaignStartTime = numberValues[0];
        campaignEndTime = numberValues[1];
        maxReferralRewardPercent = numberValues[2];
        conversionQuota = numberValues[3];
        totalSupply_ = numberValues[4];
        incentiveModel = IncentiveModel(numberValues[5]);
        bountyPerConversionWei = numberValues[6];
        received_from[_contractor] = _contractor;
        balances[_contractor] = totalSupply_;

        isCampaignInitialized = true;
    }


    modifier contractNotLocked {
        require(merkleRoot == 0);
        _;
    }

    /**
     * @notice Function to validate that contracts plasma and public are well mirrored
     */
    function validateContractFromMaintainer()
    public
    onlyMaintainer
    {
        isValidated = true;
    }

    /**
     * @notice Will be called only once in a lifetime, immediately after campaign on public network is deployed
     * @param _mirrorCampaign is the campaign address on public network
     */
    function setMirrorCampaign(
        address _mirrorCampaign
    )
    public
    onlyContractor
    {
        require(mirrorCampaignOnPublic == address(0));
        mirrorCampaignOnPublic = _mirrorCampaign;
    }

    /**
     * @notice Function where maintainer will set on plasma network the total bounty amount
     * and how many tokens are paid per conversion for the influencers
     */
    function setTotalBounty(
        uint _totalBounty
    )
    public
    onlyMaintainer
    {
        // So if contractor adds more bounty we can increase it
        totalBountyForCampaign = totalBountyForCampaign.add(_totalBounty);
        maxNumberOfConversions = totalBountyForCampaign.div(bountyPerConversionWei);
    }


    /**
     * @notice Function to get total bounty available and bounty per conversion
     * @return tuple
     */
    function getTotalBountyAndBountyPerConversion()
    public
    view
    returns (uint,uint)
    {
        return (totalBountyForCampaign, bountyPerConversionWei);
    }

    /**
     * @notice Function to return referrers participated in the referral chain
     * @param customer is the one who converted
     * @return array of referrer addresses
     */
    function getReferrers(
        address customer
    )
    public
    view
    returns (address[])
    {
        address influencer = customer;
        uint n_influencers = 0;

        while (true) {
            influencer = getReceivedFrom(influencer);
            if (influencer == contractor) {
                break;
            }
            n_influencers = n_influencers.add(1);
        }
        address[] memory influencers = new address[](n_influencers);
        influencer = customer;

        while (n_influencers > 0) {
            influencer = getReceivedFrom(influencer);
            n_influencers = n_influencers.sub(1);
            influencers[n_influencers] = influencer;
        }
        return influencers;
    }

    function approveConverterAndExecuteConversion(
        address converter
    )
    public
    contractNotLocked
    onlyMaintainer
    {
        //Restricting this method to 1 call per converter
        require(isApprovedConverter[converter] == false);
        isApprovedConverter[converter] = true;

        //Get the conversion and modify the state
        uint conversionId = converterToConversionId[converter];
        Conversion c = conversions[conversionId];
        c.state = ConversionState.EXECUTED;

        if(numberOfExecutedConversions < maxNumberOfConversions) {
            c.bountyPaid = bountyPerConversionWei;
            updateRewardsBetweenInfluencers(converter, conversionId);
        }

        //Increment number of executed conversions
        numberOfExecutedConversions = numberOfExecutedConversions.add(1);
    }

    function getReferrerBalanceAndTotalEarningsAndNumberOfConversions(
        address _referrerAddress,
        bytes _sig,
        uint[] _conversionIds
    )
    public
    view
    returns (uint,uint,uint,uint[],address)
    {

        if(_sig.length > 0) {
//            _referrerAddress = recover(_sig);
        }
        else {
//            require(msg.sender == _referrerAddress || msg.sender == contractor || ITwoKeyMaintainersRegistry(twoKeyMaintainersRegistry).onlyMaintainer(msg.sender));
            _referrerAddress = _referrerAddress;
        }

    uint len = _conversionIds.length;
        uint[] memory earnings = new uint[](len);

        for(uint i=0; i<len; i++) {
            earnings[i] = referrerPlasma2EarningsPerConversion[_referrerAddress][_conversionIds[i]];
        }

        uint referrerBalance = referrerPlasma2Balances2key[_referrerAddress];
        return (referrerBalance, referrerPlasma2TotalEarnings2key[_referrerAddress], referrerPlasmaAddressToCounterOfConversions[_referrerAddress], earnings, _referrerAddress);
    }

    /**
     * @notice Function where converter can convert
     */
    function convertInternal(
        bytes signature,
        address converter
    )
    private
    {
        require(isConverter[converter] == false); // Requiring that user can convert only 1 time
        isConverter[converter] = true;

        if(received_from[converter] == address(0)) {
            distributeArcsBasedOnSignature(signature, converter);
        }
    }


    function convert(
        bytes signature
    )
    contractNotLocked
    public
    {
        require(merkleRoot == 0);
        convertInternal(signature, msg.sender);

        // Create conversion
        Conversion memory c = Conversion (
            msg.sender,
            0,
            block.timestamp,
            ConversionState.PENDING_APPROVAL
        );

        // Get the ID and update mappings
        uint conversionId = conversions.length;
        conversions.push(c);
        converterToConversionId[msg.sender] = conversionId;
    }

    /**
     * @param _referrer we want to check earnings for
     */
    function getReferrerBalance(address _referrer) public view returns (uint) {
        return referrerPlasma2Balances2key[_referrer];
    }


    /**
     * @notice compute a merkle root of the active influencers and the amount they received.
     *         (active influencer is an influencer that received a bounty)
     *         this function needs to be called many times until merkle_root is not 2.
     *         In each call a merkle tree of up to N leaves (pair of active-influencer and amount) is
     *         computed and the result is added to merkle_roots. N should be a power of 2 for example N=2048.
     *         On all calls you have to use the same N value.
     *         Once you the leaves are computed you need to call this function one more time to compute the
     *         merkle_root of the entire tree from the intermidate results in merkle_roots
     */
    function computeMerkleRoots()
    public
    onlyMaintainer
    {
        require(merkleRoot == 0 || merkleRoot == 2, 'merkle root already defined');

        uint numberOfInfluencers = activeInfluencers.length;
        if (numberOfInfluencers == 0) {
            merkleRoot = bytes32(1);
            return;
        }
        merkleRoot = bytes32(2); // indicate that the merkle root is being computed

        uint start = merkle_roots.length * N;
        if (start >= numberOfInfluencers) {
            merkleRoot = MerkleProof.computeMerkleRootInternal(merkle_roots);
            return;
        }

        uint n = numberOfInfluencers - start;
        if (n > N) {
            n = N;
        }
        bytes32[] memory hashes = new bytes32[](n);
        for (uint i = 0; i < n; i++) {
            address influencer = activeInfluencers[i+start];
            uint amount = referrerPlasma2Balances2key[influencer];
            hashes[i] = keccak256(abi.encodePacked(influencer,amount));
        }
        merkle_roots.push(MerkleProof.computeMerkleRootInternal(hashes));
    }

    function executeConversion(uint conversionID) public onlyMaintainer {

    }

    function checkIsActiveInfluencerAndAddToQueue(
        address _influencer
    )
    internal
    {
        if(!isActiveInfluencer[_influencer]) {
            activeInfluencer2idx[_influencer] = activeInfluencers.length;
            activeInfluencers.push(_influencer);
            isActiveInfluencer[_influencer] = true;
        }
    }

    function getConversion(
        uint _conversionId
    )
    public
    view
    returns (address, uint, uint, ConversionState)
    {
        Conversion memory c = conversions[_conversionId];
        return (
            c.converterPlasma,
            c.bountyPaid,
            c.conversionTimestamp,
            c.state
        );
    }

    function updateRewardsBetweenInfluencers(
        address _converter,
        uint _conversionId
    )
    internal
    {

        //Get all the influencers
        address[] memory influencers = getReferrers(_converter);

        //Get array length
        uint numberOfInfluencers = influencers.length;

        uint i;
        uint reward;
        if(incentiveModel == IncentiveModel.VANILLA_AVERAGE) {
            reward = IncentiveModels.averageModelRewards(bountyPerConversionWei, numberOfInfluencers);
            for(i=0; i<numberOfInfluencers; i++) {
                updateReferrerMappings(influencers[i], reward, _conversionId);
            }
        } else if (incentiveModel == IncentiveModel.VANILLA_AVERAGE_LAST_3X) {
            uint rewardForLast;
            // Calculate reward for regular ones and for the last
            (reward, rewardForLast) = IncentiveModels.averageLast3xRewards(bountyPerConversionWei, numberOfInfluencers);
            if(numberOfInfluencers > 0) {
                //Update equal rewards to all influencers but last
                for(i=0; i<numberOfInfluencers - 1; i++) {
                    updateReferrerMappings(influencers[i], reward, _conversionId);
                }
                //Update reward for last
                updateReferrerMappings(influencers[numberOfInfluencers-1], rewardForLast, _conversionId);
            }
        } else if(incentiveModel == IncentiveModel.VANILLA_POWER_LAW) {
            // Get rewards per referrer
            uint [] memory rewards = IncentiveModels.powerLawRewards(bountyPerConversionWei, numberOfInfluencers, 2);
            //Iterate through all referrers and distribute rewards
            for(i=0; i<numberOfInfluencers; i++) {
                updateReferrerMappings(influencers[i], rewards[i], _conversionId);
            }
        }
    }

    /**
     * @notice compute a merkle proof that influencer and amount are in one of the merkle_roots.
     *       this function can be called only after you called computeMerkleRoots one or more times until merkle_root is not 2
     * @param _influencer the influencer for which we want to get a Merkle proof
     * @return index to merkle_roots
     * @return proof - array of hashes that can be used with _influencer and amount to compute the merkle_roots[index],
     *                 which prove that (_influencer,amount) are inside the root.
     *
     * The returned proof is only the first part of a proof to merkle_root.
     * The idea is that the code here does some of the work and the dApp code does the rest of the work to get a full proof
     * See https://github.com/2key/web3-alpha/commit/105b0b17ab3d20662b1e2171d84be25089962b68
     */
    function getMerkleProofBaseFromRoots(
        address _influencer // get proof for this influencer
    )
    internal
    view
    returns (uint, bytes32[])
    {

        if (isActiveInfluencer[_influencer] == false) {
            return (0, new bytes32[](0));
        }

        uint influencer_idx = activeInfluencer2idx[_influencer];

        uint start = N * (influencer_idx / N);

        influencer_idx = influencer_idx.sub(start);

        uint n = activeInfluencers.length.sub(start);

        if (n > N) {
            n = N;
        }

        bytes32[] memory hashes = new bytes32[](n);
        uint i;

        for (i = 0; i < n; i++) {
            address influencer = activeInfluencers[i+start];
            uint amount = referrerPlasma2Balances2key[influencer];
            hashes[i] = keccak256(abi.encodePacked(influencer,amount));
        }

        return (start/N, MerkleProof.getMerkleProofInternal(influencer_idx, hashes));
    }

    /**
     * @notice compute a merkle proof that influencer and amount are in the the merkle_root.
     *       this function can be called only after you called computeMerkleRoots one or more times until merkle_root is not 2
     * @return proof - array of hashes that can be used with _influencer and amount to compute the merkle_root,
     *                 which prove that (_influencer,amount) are inside the root.
     */
    function getMerkleProofFromRoots()
    public
    view
    returns (bytes32[])
    {
        address _influencer = msg.sender;
        bytes32[] memory proof0;
        uint start;
        (start, proof0) = getMerkleProofBaseFromRoots(_influencer);
        if (proof0.length == 0) {
            return proof0; // return failury
        }
        bytes32[] memory proof1 = MerkleProof.getMerkleProofInternal(start, merkle_roots);
        bytes32[] memory proof = new bytes32[](proof0.length + proof1.length);
        uint i;
        for (i = 0; i < proof0.length; i++) {
            proof[i] = proof0[i];
        }
        for (i = 0; i < proof1.length; i++) {
            proof[i+proof0.length] = proof1[i];
        }

        return proof;
    }


    function updateReferrerMappings(
        address referrerPlasma,
        uint reward,
        uint conversionId
    )
    internal
    {
        checkIsActiveInfluencerAndAddToQueue(referrerPlasma);
        referrerPlasma2Balances2key[referrerPlasma] = referrerPlasma2Balances2key[referrerPlasma].add(reward);
        referrerPlasma2TotalEarnings2key[referrerPlasma] = referrerPlasma2TotalEarnings2key[referrerPlasma].add(reward);
        referrerPlasma2EarningsPerConversion[referrerPlasma][conversionId] = reward;
        referrerPlasmaAddressToCounterOfConversions[referrerPlasma] = referrerPlasmaAddressToCounterOfConversions[referrerPlasma].add(1);
    }

    /**
     * @notice Function to get all active influencers
     */
    function getActiveInfluencers()
    public
    view
    returns (address[])
    {
        return activeInfluencers;
    }


}