const TwoKeyEconomy = artifacts.require('TwoKeyEconomy');
const TwoKeyUpgradableExchange = artifacts.require('TwoKeyUpgradableExchange');
const TwoKeyAdmin = artifacts.require('TwoKeyAdmin');
const EventSource = artifacts.require('TwoKeyEventSource');
const TwoKeyRegistry = artifacts.require('TwoKeyRegistry');
const TwoKeyCongress = artifacts.require('TwoKeyCongress');
const TwoKeyPlasmaEvents = artifacts.require('TwoKeyPlasmaEvents');
const TwoKeySingletonesRegistry = artifacts.require('TwoKeySingletonesRegistry');
const TwoKeyExchangeRateContract = artifacts.require('TwoKeyExchangeRateContract');
const TwoKeyPlasmaSingletoneRegistry = artifacts.require('TwoKeyPlasmaSingletoneRegistry');
const TwoKeyBaseReputationRegistry = artifacts.require('TwoKeyBaseReputationRegistry');
const TwoKeyCommunityTokenPool = artifacts.require('TwoKeyCommunityTokenPool');
const TwoKeyDeepFreezeTokenPool = artifacts.require('TwoKeyDeepFreezeTokenPool');
const TwoKeyLongTermTokenPool = artifacts.require('TwoKeyLongTermTokenPool');
const TwoKeyCampaignValidator = artifacts.require('TwoKeyCampaignValidator');
const TwoKeyFactory = artifacts.require('TwoKeyFactory');
const KyberNetworkTestMockContract = artifacts.require('KyberNetworkTestMockContract');


const Call = artifacts.require('Call');
const IncentiveModels = artifacts.require('IncentiveModels');

const fs = require('fs');
const path = require('path');

const proxyFile = path.join(__dirname, '../build/contracts/proxyAddresses.json');
const deploymentConfigFile = path.join(__dirname, '../deploymentConfig.json');


module.exports = function deploy(deployer) {
    const { network_id } = deployer;
    /**
     * Read the proxy file into fileObject
     * @type {{}}
     */
    let fileObject = {};
    if (fs.existsSync(proxyFile)) {
        fileObject = JSON.parse(fs.readFileSync(proxyFile, { encoding: 'utf8' }));
    }

    let deploymentObject = {};
    if( fs.existsSync(deploymentConfigFile)) {
        deploymentObject = JSON.parse(fs.readFileSync(deploymentConfigFile, {encoding: 'utf8'}));
    }


    /**
     * Define proxyAddress variables for the contracts
     */
    let proxyAddressTwoKeyRegistry;
    let proxyAddressTwoKeyEventSource;
    let proxyAddressTwoKeyExchange;
    let proxyAddressTwoKeyAdmin;
    let proxyAddressTwoKeyUpgradableExchange;
    let proxyAddressTwoKeyBaseReputationRegistry;
    let proxyAddressTwoKeyCommunityTokenPool;
    let proxyAddressTwoKeyLongTermTokenPool;
    let proxyAddressTwoKeyDeepFreezeTokenPool;
    let proxyAddressTwoKeyCampaignValidator;
    let proxyAddressTwoKeyFactory;
    let proxyAddressTwoKeyPlasmaEvents;


    let deploymentNetwork;
    if(deployer.network.startsWith('dev') || deployer.network.startsWith('plasma-test')) {
        deploymentNetwork = 'dev-local-environment'
    } else if (deployer.network.startsWith('public') || deployer.network.startsWith('plasma') || deployer.network.startsWith('private')) {
        deploymentNetwork = 'ropsten-environment';
    }

    /**
     * Initial voting powers for congress members
     * @type {number[]}
     */
    let votingPowers = deploymentObject[deploymentNetwork].votingPowers;
    let maintainerAddresses = deploymentObject[deploymentNetwork].maintainers;
    let rewardsReleaseAfter = deploymentObject[deploymentNetwork].admin2keyReleaseDate; //1 January 2020
    let initialCongressMembers = deploymentObject[deploymentNetwork].initialCongressMembers;
    let initialCongressMemberNames = deploymentObject[deploymentNetwork].initialCongressMembersNames;


    let kyberAddress;
    /**
     * KYBER NETWORK ADDRESS and DAI ADDRESS
     */
    const KYBER_NETWORK_PROXY_ADDRESS_ROPSTEN = '0x818E6FECD516Ecc3849DAf6845e3EC868087B755';
    const DAI_ROPSTEN_ADDRESS = '0xaD6D458402F60fD3Bd25163575031ACDce07538D';


    /**
     * Deployment process
     */
    deployer.deploy(Call);
    deployer.deploy(IncentiveModels);
    if (deployer.network.startsWith('dev') || deployer.network.startsWith('public.') || deployer.network.startsWith('ropsten')) {
        deployer.deploy(TwoKeyCongress, 24*60, initialCongressMembers, initialCongressMemberNames, votingPowers)
            .then(() => TwoKeyCongress.deployed())
            .then(() => deployer.deploy(TwoKeyCampaignValidator))
            .then(() => TwoKeyCampaignValidator.deployed())
            .then(() => deployer.deploy(TwoKeyAdmin))
            .then(() => TwoKeyAdmin.deployed())
            .then(() => deployer.deploy(TwoKeyExchangeRateContract))
            .then(() => TwoKeyExchangeRateContract.deployed())
            .then(() => deployer.deploy(EventSource))
            .then(() => deployer.link(Call, TwoKeyRegistry))
            .then(() => deployer.deploy(TwoKeyRegistry)
            .then(() => TwoKeyRegistry.deployed())
            .then(() => deployer.deploy(KyberNetworkTestMockContract))
            .then(() => KyberNetworkTestMockContract.deployed())
            .then(() => deployer.deploy(TwoKeyBaseReputationRegistry))
            .then(() => TwoKeyBaseReputationRegistry.deployed())
            .then(() => deployer.deploy(TwoKeyUpgradableExchange))
            .then(() => TwoKeyUpgradableExchange.deployed())
            .then(() => deployer.deploy(TwoKeyCommunityTokenPool))
            .then(() => TwoKeyCommunityTokenPool.deployed())
            .then(() => deployer.deploy(TwoKeyDeepFreezeTokenPool))
            .then(() => TwoKeyDeepFreezeTokenPool.deployed())
            .then(() => deployer.deploy(TwoKeyLongTermTokenPool))
            .then(() => TwoKeyLongTermTokenPool.deployed())
            .then(() => deployer.deploy(TwoKeyFactory))
            .then(() => TwoKeyFactory.deployed())
            .then(() => deployer.deploy(TwoKeySingletonesRegistry, maintainerAddresses, '0x0')) //adding empty admin address
            .then(() => TwoKeySingletonesRegistry.deployed().then(async (registry) => {
                /**
                 * Here we will be adding all contracts to the Registry and create a Proxies for them
                 */
                await new Promise(async (resolve, reject) => {
                    try {
                        console.log('... Adding TwoKeyRegistry to Proxy registry as valid implementation');
                        /**
                         * Adding TwoKeyRegistry to the registry, deploying 1st proxy for that 1.0 version and setting initial params there
                         */
                        let txHash = await registry.addVersion("TwoKeyRegistry", "1.0", TwoKeyRegistry.address);
                        let { logs } = await registry.createProxy("TwoKeyRegistry", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the TwoKeyRegistry is : ' + proxy);
                        console.log('Network ID', network_id);
                        const twoKeyReg = fileObject.TwoKeyRegistry || {};
                        twoKeyReg[network_id] = {
                            'address': TwoKeyRegistry.address,
                            'Proxy': proxy,
                            'Version': "1.0",
                            maintainer_address: maintainerAddresses,
                        };


                        fileObject['TwoKeyRegistry'] = twoKeyReg;
                        proxyAddressTwoKeyRegistry = proxy;
                        resolve(proxy);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async (resolve, reject) => {
                    try {
                        console.log('... Adding TwoKeyFactory to Proxy registry as valid implementation');
                        /**
                         * Adding TwoKeyRegistry to the registry, deploying 1st proxy for that 1.0 version and setting initial params there
                         */
                        let txHash = await registry.addVersion("TwoKeyFactory", "1.0", TwoKeyFactory.address);
                        let { logs } = await registry.createProxy("TwoKeyFactory", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the TwoKeyFactory is : ' + proxy);
                        console.log('Network ID', network_id);
                        const twoKeyFactory = fileObject.TwoKeyFactory || {};
                        twoKeyFactory[network_id] = {
                            'address': TwoKeyFactory.address,
                            'Proxy': proxy,
                            'Version': "1.0",
                            maintainer_address: maintainerAddresses,
                        };


                        fileObject['TwoKeyFactory'] = twoKeyFactory;
                        proxyAddressTwoKeyFactory = proxy;
                        resolve(proxy);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async (resolve, reject) => {
                    try {
                        console.log('... Adding TwoKeyCampaignValidator to Proxy registry as valid implementation');
                        /**
                         * Adding TwoKeyCampaignValidator to the registry, deploying 1st proxy for that 1.0 version and setting initial params there
                         */
                        let txHash = await registry.addVersion("TwoKeyCampaignValidator", "1.0", TwoKeyCampaignValidator.address);
                        let { logs } = await registry.createProxy("TwoKeyCampaignValidator", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the TwoKeyCampaignValidator is : ' + proxy);
                        const twoKeyValidator = fileObject.TwoKeyCampaignValidator || {};
                        twoKeyValidator[network_id] = {
                            'address': TwoKeyCampaignValidator.address,
                            'Proxy': proxy,
                            'Version': "1.0",
                            maintainer_address: maintainerAddresses,
                        };


                        fileObject['TwoKeyCampaignValidator'] = twoKeyValidator;
                        proxyAddressTwoKeyCampaignValidator = proxy;
                        resolve(proxy);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async (resolve, reject) => {
                    try {
                        console.log('... Adding TwoKeyCommunityTokenPool to Proxy registry as valid implementation');
                        /**
                         * Adding TwoKeyCommunityTokenPool to the registry, deploying 1st proxy for that 1.0 version and setting initial params there
                         */
                        let txHash = await registry.addVersion("TwoKeyCommunityTokenPool", "1.0", TwoKeyCommunityTokenPool.address);
                        let { logs } = await registry.createProxy("TwoKeyCommunityTokenPool", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the TwoKeyCommunityTokenPool is : ' + proxy);
                        const twoKeyCommunityTokenPool = fileObject.TwoKeyCommunityTokenPool || {};
                        twoKeyCommunityTokenPool[network_id] = {
                            'address': TwoKeyCommunityTokenPool.address,
                            'Proxy': proxy,
                            'Version': "1.0",
                            maintainer_address: maintainerAddresses,
                        };


                        fileObject['TwoKeyCommunityTokenPool'] = twoKeyCommunityTokenPool;
                        proxyAddressTwoKeyCommunityTokenPool = proxy;
                        resolve(proxy);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async (resolve, reject) => {
                    try {
                        console.log('... Adding TwoKeyLongTermTokenPool to Proxy registry as valid implementation');
                        /**
                         * Adding TwoKeyLongTermTokenPool to the registry, deploying 1st proxy for that 1.0 version and setting initial params there
                         */
                        let txHash = await registry.addVersion("TwoKeyLongTermTokenPool", "1.0", TwoKeyLongTermTokenPool.address);
                        let { logs } = await registry.createProxy("TwoKeyLongTermTokenPool", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the TwoKeyLongTermTokenPool is : ' + proxy);
                        const twoKeyLongTermTokenPool = fileObject.TwoKeyLongTermTokenPool || {};
                        twoKeyLongTermTokenPool[network_id] = {
                            'address': TwoKeyLongTermTokenPool.address,
                            'Proxy': proxy,
                            'Version': "1.0",
                            maintainer_address: maintainerAddresses,
                        };


                        fileObject['TwoKeyLongTermTokenPool'] = twoKeyLongTermTokenPool;
                        proxyAddressTwoKeyLongTermTokenPool = proxy;
                        resolve(proxy);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async (resolve, reject) => {
                    try {
                        console.log('... Adding TwoKeyDeepFreezeTokenPool to Proxy registry as valid implementation');
                        /**
                         * Adding TwoKeyLongTermTokenPool to the registry, deploying 1st proxy for that 1.0 version and setting initial params there
                         */
                        let txHash = await registry.addVersion("TwoKeyDeepFreezeTokenPool", "1.0", TwoKeyDeepFreezeTokenPool.address);
                        let { logs } = await registry.createProxy("TwoKeyDeepFreezeTokenPool", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the TwoKeyDeepFreezeTokenPool is : ' + proxy);
                        const twoKeyDeepFreezeTokenPool = fileObject.TwoKeyDeepFreezeTokenPool || {};
                        twoKeyDeepFreezeTokenPool[network_id] = {
                            'address': TwoKeyDeepFreezeTokenPool.address,
                            'Proxy': proxy,
                            'Version': "1.0",
                            maintainer_address: maintainerAddresses,
                        };


                        fileObject['TwoKeyDeepFreezeTokenPool'] = twoKeyDeepFreezeTokenPool;
                        proxyAddressTwoKeyDeepFreezeTokenPool = proxy;
                        resolve(proxy);
                    } catch (e) {
                        reject(e);
                    }
                });





                await new Promise(async (resolve, reject) => {
                    try {
                        console.log('... Adding TwoKeyBaseReputationRegistry to Proxy registry as valid implementation');
                        /**
                         * Adding TwoKeyBaseReputationRegistry to the registry, deploying 1st proxy for that 1.0 version and setting initial params there
                         */
                        let txHash = await registry.addVersion("TwoKeyBaseReputationRegistry", "1.0", TwoKeyBaseReputationRegistry.address);
                        let { logs } = await registry.createProxy("TwoKeyBaseReputationRegistry", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the TwoKeyBaseReputationRegistry is : ' + proxy);
                        const twoKeyBaseRepReg = fileObject.TwoKeyBaseReputationRegistry || {};
                        twoKeyBaseRepReg[network_id] = {
                            'address': TwoKeyBaseReputationRegistry.address,
                            'Proxy': proxy,
                            'Version': "1.0",
                            // maintainer_address: maintainerAddresses,
                        };

                        fileObject['TwoKeyBaseReputationRegistry'] = twoKeyBaseRepReg;
                        proxyAddressTwoKeyBaseReputationRegistry = proxy;
                        resolve(proxy);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async (resolve, reject) => {
                    try {
                        console.log('... Adding EventSource to Proxy registry as valid implementation');
                        /**
                         * Adding EventSource to the registry, deploying 1st proxy for that 1.0 version of EventSource and setting initial params there
                         */
                        let txHash = await registry.addVersion("TwoKeyEventSource", "1.0", EventSource.address);
                        let { logs } = await registry.createProxy("TwoKeyEventSource", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the EventSource is : ' + proxy);

                        const twoKeyEventS = fileObject.TwoKeyEventSource || {};

                        twoKeyEventS[network_id] = {
                            'address': EventSource.address,
                            'Proxy': proxy,
                            'Version': "1.0",
                            maintainer_address: maintainerAddresses,
                        };
                        fileObject['TwoKeyEventSource'] = twoKeyEventS;
                        proxyAddressTwoKeyEventSource = proxy;
                        resolve(proxy);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async (resolve,reject) => {
                    try {
                        console.log('... Adding TwoKeyExchangeRateContract to Proxy registry as valid implementation');
                        /**
                         * Adding EventSource to the registry, deploying 1st proxy for that 1.0 version of EventSource
                         */
                        let txHash = await registry.addVersion("TwoKeyExchangeRateContract", "1.0", TwoKeyExchangeRateContract.address);
                        let { logs } = await registry.createProxy("TwoKeyExchangeRateContract", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the TwoKeyExchangeRateContract is : ' + proxy);

                        const twoKeyExchangeRate = fileObject.TwoKeyExchange || {};

                        twoKeyExchangeRate[network_id] = {
                            'address': TwoKeyExchangeRateContract.address,
                            'Proxy': proxy,
                            'Version': "1.0",
                            maintainer_address: maintainerAddresses,
                        };
                        fileObject['TwoKeyExchangeRateContract'] = twoKeyExchangeRate;
                        proxyAddressTwoKeyExchange = proxy;

                        resolve(proxy);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('... Adding TwoKeyAdmin contract to proxy registry as valid implementation');
                        /**
                         * Adding TwoKeyAdmin to the registry, deploying 1st proxy for that 1.0 version of TwoKeyAdmin
                         */
                        let txHash = await registry.addVersion("TwoKeyAdmin", "1.0", TwoKeyAdmin.address);
                        let { logs } = await registry.createProxy("TwoKeyAdmin", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the TwoKeyAdmin contract is : ' + proxy);


                        // txHash = await TwoKeyAdmin.at(proxy).transfer2KeyTokens(proxyAddressTwoKeyRegistry, 1000000000000000);
                        const twoKeyAdmin = fileObject.TwoKeyAdmin || {};
                        twoKeyAdmin[network_id] = {
                            'address': TwoKeyAdmin.address,
                            'Proxy': proxy,
                            'Version': "1.0",
                            maintainer_address: maintainerAddresses
                        };

                        fileObject['TwoKeyAdmin'] = twoKeyAdmin;
                        proxyAddressTwoKeyAdmin = proxy;

                        resolve(proxy);

                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('... Adding TwoKeyUpgradableExchange contract to proxy registry as valid implementation');
                        /**
                         * Adding TwoKeyUpgradableExchange to the registry, deploying 1st proxy for that 1.0 version of TwoKeyUpgradableExchange
                         */
                        let txHash = await registry.addVersion("TwoKeyUpgradableExchange", "1.0", TwoKeyUpgradableExchange.address);
                        let { logs } = await registry.createProxy("TwoKeyUpgradableExchange", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the TwoKeyUpgradableExchange contract is : ' + proxy);

                        const twoKeyUpgradableExchange = fileObject.TwoKeyUpgradableExchange || {};
                        twoKeyUpgradableExchange[network_id] = {
                            'address' : TwoKeyUpgradableExchange.address,
                            'Proxy' : proxy,
                            'Version' : "1.0",
                            maintainer_address: maintainerAddresses
                        };

                        fileObject['TwoKeyUpgradableExchange'] = twoKeyUpgradableExchange;
                        proxyAddressTwoKeyUpgradableExchange = proxy;
                        fs.writeFileSync(proxyFile, JSON.stringify(fileObject, null, 4));
                        resolve(proxy);
                    } catch (e) {
                        reject(e);
                    }
                });
            }))
            .then(() => deployer.deploy(TwoKeyEconomy,proxyAddressTwoKeyAdmin, TwoKeySingletonesRegistry.address))
            .then(() => TwoKeyEconomy.deployed())
            .then(async () => {
                /**
                 * Here we will add congress contract to the registry
                 */
                await new Promise(async (resolve,reject) => {
                    try {

                        console.log('Adding non-upgradable contracts to the registry');
                        console.log('Adding TwoKeyCongress to the registry as non-upgradable contract');
                        let txHash = await TwoKeySingletonesRegistry.at(TwoKeySingletonesRegistry.address)
                            .addNonUpgradableContractToAddress('TwoKeyCongress', TwoKeyCongress.address);
                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });
                /**
                 * Here we will add economy contract to the registry
                 */
                await new Promise(async (resolve,reject) => {
                    try {
                        console.log('Adding TwoKeyEconomy to the registry as non-upgradable contract');
                        let txHash = await TwoKeySingletonesRegistry.at(TwoKeySingletonesRegistry.address)
                            .addNonUpgradableContractToAddress('TwoKeyEconomy', TwoKeyEconomy.address);
                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });

                /**
                 * Determine which network are we using
                 */
                if(deployer.network.startsWith('dev')) {
                    kyberAddress = KyberNetworkTestMockContract.address;
                } else {
                    kyberAddress = KYBER_NETWORK_PROXY_ADDRESS_ROPSTEN;
                }

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('Setting initial parameters in contract TwoKeyCommunityTokenPool');
                        let txHash = await TwoKeyCommunityTokenPool.at(proxyAddressTwoKeyCommunityTokenPool).setInitialParams(
                            proxyAddressTwoKeyAdmin,
                            TwoKeyEconomy.address,
                            maintainerAddresses,
                            proxyAddressTwoKeyRegistry
                        );
                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('Setting initial parameters in contract TwoKeyLongTermTokenPool');
                        let txHash = await TwoKeyLongTermTokenPool.at(proxyAddressTwoKeyLongTermTokenPool).setInitialParams(
                            proxyAddressTwoKeyAdmin,
                            TwoKeyEconomy.address,
                            maintainerAddresses,
                        );
                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('Setting initial parameters in contract TwoKeyDeepFreezeTokenPool');
                        let txHash = await TwoKeyDeepFreezeTokenPool.at(proxyAddressTwoKeyDeepFreezeTokenPool).setInitialParams(
                            proxyAddressTwoKeyAdmin,
                            TwoKeyEconomy.address,
                            maintainerAddresses,
                            proxyAddressTwoKeyCommunityTokenPool
                        );
                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('Setting initial parameters in contract TwoKeyCampaignValidator');
                        let txHash = await TwoKeyCampaignValidator.at(proxyAddressTwoKeyCampaignValidator).setInitialParams(
                            TwoKeySingletonesRegistry.address,
                            maintainerAddresses
                        );
                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('Setting initial parameters in contract EventSource');
                        let txHash = await EventSource.at(proxyAddressTwoKeyEventSource).setInitialParams(
                            proxyAddressTwoKeyAdmin,
                            maintainerAddresses,
                            proxyAddressTwoKeyRegistry,
                            proxyAddressTwoKeyCampaignValidator
                        );
                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('Setting initial parameters in contract TwoKeyBaseReputationRegistry');
                        let txHash = await TwoKeyBaseReputationRegistry.at(proxyAddressTwoKeyBaseReputationRegistry).setInitialParams(
                            TwoKeySingletonesRegistry.address,
                            maintainerAddresses
                        );
                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('Setting initial parameters in contract TwoKeyExchangeRateContract');
                        let txHash = await TwoKeyExchangeRateContract.at(proxyAddressTwoKeyExchange).setInitialParams(
                            maintainerAddresses,
                            proxyAddressTwoKeyAdmin
                        );
                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('Setting initial parameters in contract TwoKeyUpgradableExchange');
                        let txHash = await TwoKeyUpgradableExchange.at(proxyAddressTwoKeyUpgradableExchange).setInitialParams(
                            proxyAddressTwoKeyAdmin,
                            TwoKeyEconomy.address,
                            proxyAddressTwoKeyExchange,
                            proxyAddressTwoKeyCampaignValidator,
                            DAI_ROPSTEN_ADDRESS,
                            kyberAddress,
                            TwoKeySingletonesRegistry.address,
                            maintainerAddresses,
                        );

                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });
                //TODO: Change proxyAddressTwoKeyExchange to proxyTwoKeyExchangeRate -
                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('Setting initial parameters in contract TwoKeyAdmin');
                        let txHash = await TwoKeyAdmin.at(proxyAddressTwoKeyAdmin).setInitialParams(
                            TwoKeyCongress.address,
                            TwoKeyEconomy.address,
                            proxyAddressTwoKeyUpgradableExchange,
                            proxyAddressTwoKeyRegistry,
                            proxyAddressTwoKeyEventSource,
                            deployer.network.startsWith('dev') ? 1 : rewardsReleaseAfter
                        );

                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('Setting initial parameters in contract TwoKeyFactory');
                        let txHash = await TwoKeyFactory.at(proxyAddressTwoKeyFactory).setInitialParams(
                            TwoKeySingletonesRegistry.address,
                            proxyAddressTwoKeyAdmin,
                            maintainerAddresses
                        );

                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });

                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('Setting initial parameters in contract TwoKeyRegistry');
                        let txHash = await TwoKeyRegistry.at(proxyAddressTwoKeyRegistry).setInitialParams
                        (
                            proxyAddressTwoKeyEventSource,
                            proxyAddressTwoKeyAdmin,
                            maintainerAddresses,
                        );

                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                });
            })
            .then(() => true)
            .catch((err) => {
                console.log('\x1b[31m', 'Error:', err.message, '\x1b[0m');
            }));
    } else if (deployer.network.startsWith('plasma') || deployer.network.startsWith('private')) {
        deployer.link(Call, TwoKeyPlasmaEvents);
        deployer.deploy(TwoKeyPlasmaEvents)
            .then(() => deployer.deploy(TwoKeyPlasmaSingletoneRegistry, [], '0x0')) //adding empty admin address
            .then(() => TwoKeyPlasmaSingletoneRegistry.deployed().then(async (registry) => {
                await new Promise(async(resolve,reject) => {
                    try {
                        console.log('... Adding TwoKeyPlasmaEvents to Plasma Proxy registry as valid implementation');
                        /**
                         * Adding TwoKeyPlasmaEvents to the registry, deploying 1st proxy for that 1.0 version and setting initial params there
                         */
                        let txHash = await registry.addVersion("TwoKeyPlasmaEvents", "1.0", TwoKeyPlasmaEvents.address);
                        let { logs } = await registry.createProxy("TwoKeyPlasmaEvents", "1.0");
                        let { proxy } = logs.find(l => l.event === 'ProxyCreated').args;
                        console.log('Proxy address for the TwoKeyPlasmaEvents is : ' + proxy);
                        const twoKeyPlasmaEvents = fileObject.TwoKeyPlasmaEvents || {};

                        twoKeyPlasmaEvents[network_id] = {
                            'address': TwoKeyPlasmaEvents.address,
                            'Proxy': proxy,
                            'Version': "1.0",
                            maintainer_address: maintainerAddresses,
                        };
                        console.log('TwoKeyPlasmaEvents', network_id);
                        fileObject['TwoKeyPlasmaEvents'] = twoKeyPlasmaEvents;
                        proxyAddressTwoKeyPlasmaEvents = proxy;
                        fs.writeFileSync(proxyFile, JSON.stringify(fileObject, null, 4));
                        resolve(proxy);
                    } catch (e) {
                        reject(e);
                    }
                })
            }))
            .then(async () => {
                await new Promise(async (resolve,reject) => {
                    try {
                        console.log('Setting initial params in plasma contract on plasma network');
                        let txHash = await TwoKeyPlasmaEvents.at(proxyAddressTwoKeyPlasmaEvents).setInitialParams
                        (
                            maintainerAddresses
                        );
                        resolve(txHash);
                    } catch (e) {
                        reject(e);
                    }
                })
            })
            .then(() => true)
            .catch((err) => {
                console.log('\x1b[31m', 'Error:', err.message, '\x1b[0m');
            });
    }
};
