pragma solidity ^0.4.24;

import "../singleton-contracts/TwoKeyEventSource.sol";
import "../campaign-mutual-contracts/TwoKeyCampaign.sol";

import "../interfaces/ITwoKeyConversionHandler.sol";
import "../interfaces/ITwoKeyAcquisitionLogicHandler.sol";
import "../upgradable-pattern-campaigns/UpgradeableCampaign.sol";


/**
 * @author Nikola Madjarevic
 * @notice Campaign which will sell ERC20 tokens
 */
contract TwoKeyAcquisitionCampaignERC20 is UpgradeableCampaign, TwoKeyCampaign {

    bool isCampaignInitialized; // Once this is set to true can't be modified

    address public conversionHandler; // Address of conversion handler contract
    address public twoKeyAcquisitionLogicHandler; // Address of logic handler contract

    address assetContractERC20; // Asset contract is address of ERC20 inventory

    mapping(address => uint256) private amountConverterSpentFiatWei; // Amount converter spent for Fiat conversions
    mapping(address => uint256) private amountConverterSpentEthWEI; // Amount converter put to the contract in Ether
    mapping(address => uint256) private unitsConverterBought; // Number of units (ERC20 tokens) bought
    mapping(address => uint256) private referrerPlasma2cut; // Mapping representing how much are cuts in percent(0-100) for referrer address

    uint reservedAmountOfTokens; // Reserved amount of tokens for the converters who are pending approval


    /**
     * @notice This function is simulation for the constructor, since we're relying on proxies
     * @param _twoKeySingletonesRegistry is the address of TwoKeySingletonsRegistry contract
     * @param _twoKeyAcquisitionLogicHandler is the address of TwoKeyAcquisitionLogicHandler contract
     * @param _conversionHandler is the address of TwoKeyConversionHandler contract
     * @param _moderator is the moderator address
     * @param _assetContractERC20 is the ERC20 contract being sold inside campaign
     * @param _contractor is the contractor of the campaign
     * @param values is the array containing values [maxReferralRewardPercent (in weis), conversionQuota]
     */
    function setInitialParamsCampaign(
        address _twoKeySingletonesRegistry,
        address _twoKeyAcquisitionLogicHandler,
        address _conversionHandler,
        address _moderator,
        address _assetContractERC20,
        address _contractor,
        uint [] values
    )
    public
    {
        require(isCampaignInitialized == false); // Security layer to make sure the function will act as a constructor

        contractor = _contractor;
        moderator = _moderator;

        twoKeySingletonesRegistry = _twoKeySingletonesRegistry;

        twoKeyEventSource = TwoKeyEventSource(getContractProxyAddress("TwoKeyEventSource"));
        twoKeyEconomy = ITwoKeySingletoneRegistryFetchAddress(_twoKeySingletonesRegistry).getNonUpgradableContractAddress("TwoKeyEconomy");

        if(values[2] == 1) {
            //Since declaration defaults to false, only if values[2] is 1 means we want KYC
            isKYCRequired = true;
        }

        if(values[3] == 1) {
            mustConvertToReferr = true;
        }

        ownerPlasma = twoKeyEventSource.plasmaOf(contractor);
        received_from[ownerPlasma] = ownerPlasma;
        totalSupply_ = 1000000;
        balances[ownerPlasma] = totalSupply_;

        maxReferralRewardPercent = values[0];
        conversionQuota = values[1];

        twoKeyAcquisitionLogicHandler = _twoKeyAcquisitionLogicHandler;
        conversionHandler = _conversionHandler;
        assetContractERC20 = _assetContractERC20;

        isCampaignInitialized = true;
    }

    /**
     * @notice Modifier which will enable only twoKeyConversionHandlerContract to execute some functions
     */
    modifier onlyTwoKeyConversionHandler() {
        require(msg.sender == address(conversionHandler));
        _;
    }


    /**
     * @notice Internal function to check the balance of the specific ERC20 on this contract
     * @param tokenAddress is the ERC20 contract address
     */
    function getTokenBalance(
        address tokenAddress
    )
    internal
    view
    returns (uint)
    {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    /**
     * @notice Function to set cut of
     * @param me is the address (ethereum)
     * @param cut is the cut value
     */
    function setCutOf(
        address me,
        uint256 cut
    )
    internal
    {
        // what is the percentage of the bounty s/he will receive when acting as an influencer
        // the value 255 is used to signal equal partition with other influencers
        // A sender can set the value only once in a contract
        address plasma = twoKeyEventSource.plasmaOf(me);
        require(referrerPlasma2cut[plasma] == 0 || referrerPlasma2cut[plasma] == cut);
        referrerPlasma2cut[plasma] = cut;
    }

    /**
     * @notice Function to set cut
     * @param cut is the cut value
     * @dev Executes internal setCutOf method
     */
    function setCut(
        uint256 cut
    )
    public
    {
        setCutOf(msg.sender, cut);
    }


    /**
     * @notice Function to track arcs and make ref tree
     * @param sig is the signature user joins from
     */
    function distributeArcsBasedOnSignature(
        bytes sig,
        address _converter
    )
    private
    {
        address[] memory influencers;
        address[] memory keys;
        uint8[] memory weights;
        address old_address;
        (influencers, keys, weights, old_address) = super.getInfluencersKeysAndWeightsFromSignature(sig, _converter);
        uint i;
        address new_address;
        uint numberOfInfluencers = influencers.length;
        for (i = 0; i < numberOfInfluencers; i++) {
            new_address = twoKeyEventSource.plasmaOf(influencers[i]);

            if (received_from[new_address] == 0) {
                transferFrom(old_address, new_address, 1);
            } else {
                require(received_from[new_address] == old_address,'only tree ARCs allowed');
            }
            old_address = new_address;

            // TODO Updating the public key of influencers may not be a good idea because it will require the influencers to use
            // a deterministic private/public key in the link and this might require user interaction (MetaMask signature)
            // TODO a possible solution is change public_link_key to address=>address[]
            // update (only once) the public address used by each influencer
            // we will need this in case one of the influencers will want to start his own off-chain link
            if (i < keys.length) {
                setPublicLinkKeyOf(new_address, keys[i]);
            }

            // update (only once) the cut used by each influencer
            // we will need this in case one of the influencers will want to start his own off-chain link
            if (i < weights.length) {
                setCutOf(new_address, uint256(weights[i]));
            }
        }
    }


    /**
     * @notice Function to add fiat inventory for rewards
     * @dev only contractor can add this inventory
     */
    function specifyFiatConversionRewards()
    public
    onlyContractor
    payable
    {
        //If you send eth, we ignore argument and create your fiat inventory amount with buying tokens
        if(msg.value > 0) {
            buyTokensFromUpgradableExchange(msg.value, address(this));
        }
    }


    /**
     * @notice Function to join with signature and share 1 arc to the receiver
     * @param signature is the signature
     * @param receiver is the address we're sending ARCs to
     */
    function joinAndShareARC(
        bytes signature,
        address receiver
    )
    public
    {
        distributeArcsBasedOnSignature(signature, msg.sender);
        transferFrom(twoKeyEventSource.plasmaOf(msg.sender), twoKeyEventSource.plasmaOf(receiver), 1);
    }


    /**
     * @notice Function where converter can convert
     * @dev payable function
     */
    function convert(
        bytes signature,
        bool _isAnonymous
    )
    public
    payable
    {
        bool canConvert;
        (canConvert,) = ITwoKeyAcquisitionLogicHandler(twoKeyAcquisitionLogicHandler).canMakeETHConversion(
            msg.sender,
            msg.value
        );
        require(canConvert == true);
        address _converterPlasma = twoKeyEventSource.plasmaOf(msg.sender);
        if(received_from[_converterPlasma] == address(0)) {
            distributeArcsBasedOnSignature(signature, msg.sender);
        }
        createConversion(msg.value, msg.sender, false, _isAnonymous);
        amountConverterSpentEthWEI[msg.sender] += msg.value;
        twoKeyEventSource.converted(address(this),msg.sender,msg.value);
    }

    /**
     * @notice Function to convert if the conversion is in fiat
     * @dev This can be executed only in case currency is fiat
     * @param _converter is the address of converter who want's fiat conversion
     * @param conversionAmountFiatWei is the amount of conversion converted to wei units
     * @param _isAnonymous if converter chooses to be anonymous
     */
    function convertFiat(
        bytes signature,
        address _converter,
        uint conversionAmountFiatWei,
        bool _isAnonymous
    )
    public
    {
        // Validate that sender is either _converter or maintainer
        require(msg.sender == _converter || twoKeyEventSource.isAddressMaintainer(msg.sender));
        bool canConvert;
        (canConvert,) = ITwoKeyAcquisitionLogicHandler(twoKeyAcquisitionLogicHandler).canMakeFiatConversion(
            _converter,
            conversionAmountFiatWei
        );
        require(canConvert == true);
        address _converterPlasma = twoKeyEventSource.plasmaOf(_converter);
        if(received_from[_converterPlasma] == address(0)) {
            distributeArcsBasedOnSignature(signature, _converter);
        }
        //TODO: Handle at creation moment if there's enough tokens for referral rewards depending on conversion fiat amount
        createConversion(conversionAmountFiatWei, _converter, true, _isAnonymous);
        amountConverterSpentFiatWei[_converter] = amountConverterSpentFiatWei[_converter].add(conversionAmountFiatWei);
    }

    /*
     * @notice Function which is executed to create conversion
     * @param conversionAmountETHWeiOrFiat is the amount of the ether sent to the contract
     * @param converterAddress is the sender of eth to the contract
     */
    function createConversion(
        uint conversionAmountETHWeiOrFiat,
        address converterAddress,
        bool isFiatConversion,
        bool isAnonymous
    )
    private
    {
        uint baseTokensForConverterUnits;
        uint bonusTokensForConverterUnits;

        (baseTokensForConverterUnits, bonusTokensForConverterUnits)
        = ITwoKeyAcquisitionLogicHandler(twoKeyAcquisitionLogicHandler).getEstimatedTokenAmount(conversionAmountETHWeiOrFiat, isFiatConversion);

        uint totalTokensForConverterUnits = baseTokensForConverterUnits + bonusTokensForConverterUnits;

        uint256 _total_units = getAvailableAndNonReservedTokensAmount();
        require(_total_units >= totalTokensForConverterUnits);

        unitsConverterBought[converterAddress] = unitsConverterBought[converterAddress].add(totalTokensForConverterUnits);

        uint256 maxReferralRewardFiatOrETHWei = conversionAmountETHWeiOrFiat.mul(maxReferralRewardPercent).div(100);

        if(isFiatConversion == false) {
            reservedAmountOfTokens = reservedAmountOfTokens + totalTokensForConverterUnits;
        }

        uint id = ITwoKeyConversionHandler(conversionHandler).supportForCreateConversion(contractor, converterAddress,
            conversionAmountETHWeiOrFiat, maxReferralRewardFiatOrETHWei,
            baseTokensForConverterUnits,bonusTokensForConverterUnits, isFiatConversion, isAnonymous, isKYCRequired);

        if(isKYCRequired == false) {
            if(isFiatConversion == false || ITwoKeyConversionHandler(conversionHandler).isFiatConversionAutomaticallyApproved()) {
                ITwoKeyConversionHandler(conversionHandler).executeConversion(id);
            }
        }
    }

    /**
     * @notice Function to delegate call to logic handler and update data, and buy tokens
     * @param _maxReferralRewardETHWei total reward in ether wei
     * @param _converter is the converter address
     * @param _conversionId is the ID of conversion
     */
    function buyTokensAndDistributeReferrerRewards(
        uint256 _maxReferralRewardETHWei,
        address _converter,
        uint _conversionId,
        bool _isConversionFiat
    )
    public
    onlyTwoKeyConversionHandler
    returns (uint)
    {
        //Fiat rewards = fiatamount * moderatorPercentage / 100  / 0.095
        uint totalBounty2keys;
        //If fiat conversion do exactly the same just send different reward and don't buy tokens, take them from contract
        if(maxReferralRewardPercent > 0) {
            if(_isConversionFiat) {
                address upgradableExchange = getContractProxyAddress("TwoKeyUpgradableExchange");
                uint rate = IUpgradableExchange(upgradableExchange).rate();
                totalBounty2keys = (_maxReferralRewardETHWei / (rate)) * (1000);
                //TODO: add require that there's enough tokens at this moment
            } else {
                //Buy tokens from upgradable exchange
                totalBounty2keys = buyTokensFromUpgradableExchange(_maxReferralRewardETHWei, address(this));
            }
            // Update reserved amount
            reservedAmount2keyForRewards = reservedAmount2keyForRewards + totalBounty2keys;
            //Handle refchain rewards
            ITwoKeyAcquisitionLogicHandler(twoKeyAcquisitionLogicHandler).updateRefchainRewards(
                _maxReferralRewardETHWei,
                _converter,
                _conversionId,
                totalBounty2keys);
        }
        return totalBounty2keys;
    }


    /**
     * @notice Function which will buy tokens from upgradable exchange for moderator
     * @param moderatorFee is the fee in tokens moderator earned
     */
    function buyTokensForModeratorRewards(
        uint moderatorFee
    )
    public
    onlyTwoKeyConversionHandler
    {
        //Get deep freeze token pool address
        address twoKeyDeepFreezeTokenPool = getContractProxyAddress("TwoKeyDeepFreezeTokenPool");

        uint networkFee = twoKeyEventSource.getTwoKeyDefaultNetworkTaxPercent();

        // Balance which will go to modrator
        uint balance = moderatorFee.mul(100-networkFee).div(100);

        uint moderatorEarnings2key = buyTokensFromUpgradableExchange(balance,moderator); // Buy tokens for moderator
        buyTokensFromUpgradableExchange(moderatorFee - balance, twoKeyDeepFreezeTokenPool); // Buy tokens for deep freeze token pool

        moderatorTotalEarnings2key = moderatorTotalEarnings2key.add(moderatorEarnings2key);
    }

    /**
     * @notice Function to send ether back to converter if his conversion is cancelled
     * @param _cancelledConverter is the address of cancelled converter
     * @param _conversionAmount is the amount he sent to the contract
     * @dev This function can be called only by conversion handler
     */
    function sendBackEthWhenConversionCancelled(
        address _cancelledConverter,
        uint _conversionAmount
    )
    public
    onlyTwoKeyConversionHandler
    {
        _cancelledConverter.transfer(_conversionAmount);
        amountConverterSpentEthWEI[_cancelledConverter] = amountConverterSpentEthWEI[_cancelledConverter].sub(_conversionAmount);
    }

    /**
     * @notice Move some amount of ERC20 from our campaign to someone
     * @param _to address we're sending the amount of ERC20
     * @param _amount is the amount of ERC20's we're going to transfer
     * @return true if successful, otherwise reverts
     */
    function moveFungibleAsset(
        address _to,
        uint256 _amount
    )
    public
    onlyTwoKeyConversionHandler
    {
        IERC20(assetContractERC20).transfer(_to, _amount);
    }


    /**
     * @notice Option to update contractor proceeds
     * @dev can be called only from TwoKeyConversionHandler contract
     * @param value it the value we'd like to add to total contractor proceeds and contractor balance
     */
    function updateContractorProceeds(
        uint value
    )
    public
    onlyTwoKeyConversionHandler
    {
        contractorTotalProceeds = contractorTotalProceeds.add(value);
        contractorBalance = contractorBalance.add(value);
    }

    /**
     * @notice Function to update amount of the reserved tokens in case conversion is rejected
     * @param value is the amount to reduce from reserved state
     */
    function updateReservedAmountOfTokensIfConversionRejectedOrExecuted(
        uint value
    )
    public
    onlyTwoKeyConversionHandler
    {
        reservedAmountOfTokens = reservedAmountOfTokens.sub(value);
    }

    /**
     * @notice Function to return status of inventory
     * @return current ERC20 balance on inventory address, reserved amount of tokens for converters,
     * and reserved amount of tokens for the rewards
     */
    function getInventoryStatus()
    public
    view
    returns (uint,uint,uint,uint)
    {
        uint inventoryBalance = getTokenBalance(assetContractERC20);
        if(assetContractERC20 == twoKeyEconomy) {
            return (inventoryBalance, reservedAmountOfTokens, reservedAmount2keyForRewards, inventoryBalance);
        } else {
            return (inventoryBalance, reservedAmountOfTokens, reservedAmount2keyForRewards, getTokenBalance(twoKeyEconomy));
        }
    }

    /**
     * @notice Function which acts like getter for all cuts in array
     * @param last_influencer is the last influencer
     * @return array of integers containing cuts respectively
     */
    function getReferrerCuts(
        address last_influencer
    )
    public
    view
    returns (uint256[])
    {
        address[] memory influencers = ITwoKeyAcquisitionLogicHandler(twoKeyAcquisitionLogicHandler).getReferrers(last_influencer,address(this));
        uint256[] memory cuts = new uint256[](influencers.length + 1);

        uint numberOfInfluencers = influencers.length;
        for (uint i = 0; i < numberOfInfluencers; i++) {
            address influencer = influencers[i];
            cuts[i] = getReferrerCut(influencer);
        }
        cuts[influencers.length] = getReferrerCut(last_influencer);
        return cuts;
    }

    /**
     * @notice Function to get cut for an (ethereum) address
     * @param me is the ethereum address
     */
    function getReferrerCut(
        address me
    )
    public
    view
    returns (uint256)
    {
        return referrerPlasma2cut[twoKeyEventSource.plasmaOf(me)];
    }


    /**
     * @notice Function to check available amount of the tokens on the contract
     */
    function getAvailableAndNonReservedTokensAmount()
    public
    view
    returns (uint)
    {
        uint inventoryBalance = getTokenBalance(assetContractERC20);
        if(assetContractERC20 == twoKeyEconomy) {
            return (inventoryBalance - reservedAmountOfTokens - reservedAmount2keyForRewards);
        }
        return (inventoryBalance - reservedAmountOfTokens);
    }

    /**
     * @notice Function to fetch contractor balance in ETH
     * @dev only contractor can call this function, otherwise it will revert
     * @return value of contractor balance in ETH WEI
     */
    function getContractorBalance()
    external
    onlyContractor
    view
    returns (uint)
    {
        return contractorBalance;
    }


    /**
     * @notice Function to get balance of influencer for his plasma address
     * @param _influencer is the plasma address of influencer
     * @return balance in wei's
     */
    function getReferrerPlasmaBalance(
        address _influencer
    )
    public
    view
    returns (uint)
    {
        require(msg.sender == twoKeyAcquisitionLogicHandler);
        return (referrerPlasma2Balances2key[_influencer]);
    }

    /**
     * @notice Function to update referrer plasma balance
     * @param _influencer is the plasma address of referrer
     * @param _balance is the new balance
     */
    function updateReferrerPlasmaBalance(
        address _influencer,
        uint _balance
    )
    public
    {
        require(msg.sender == twoKeyAcquisitionLogicHandler);
        referrerPlasma2Balances2key[_influencer] = referrerPlasma2Balances2key[_influencer].add(_balance);
    }

    /**
     * @notice Function to get statistic for the address
     * @param ethereum is the ethereum address we want to get stats for
     * @param plasma is the corresponding plasma address for the passed ethereum address
     */
    function getStatistics(
        address ethereum,
        address plasma
    )
    public
    view
    returns (uint,uint,uint,uint)
    {
        //TODO: Uncomment once we fix all issues
//        require(msg.sender == twoKeyAcquisitionLogicHandler);
        uint referrerTotalEarnings = ITwoKeyAcquisitionLogicHandler(twoKeyAcquisitionLogicHandler).getReferrerPlasmaTotalEarnings(plasma);
        return (amountConverterSpentEthWEI[ethereum], amountConverterSpentFiatWei[ethereum], referrerTotalEarnings,unitsConverterBought[ethereum]);
    }

    /**
     * @notice Function where contractor can withdraw all unsold tokens from his campaign once time has passed
     * @dev This function will throw in case the caller is not contractor
     */
    function withdrawUnsoldTokens() onlyContractor {
        //TODO: Add time requirement
        uint unsoldTokens = getAvailableAndNonReservedTokensAmount();
        IERC20(assetContractERC20).transfer(contractor, unsoldTokens);
    }
}

