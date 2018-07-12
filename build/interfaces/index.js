module.exports={version:1531390770187,date:"Thu Jul 12 2018",Migrations:{abi:[{constant:!0,inputs:[],name:"last_completed_migration",outputs:[{name:"",type:"uint256"}],payable:!1,stateMutability:"view",type:"function"},{constant:!0,inputs:[],name:"owner",outputs:[{name:"",type:"address"}],payable:!1,stateMutability:"view",type:"function"},{inputs:[],payable:!1,stateMutability:"nonpayable",type:"constructor"},{constant:!1,inputs:[{name:"completed",type:"uint256"}],name:"setCompleted",outputs:[],payable:!1,
stateMutability:"nonpayable",type:"function"},{constant:!1,inputs:[{name:"new_address",type:"address"}],name:"upgrade",outputs:[],payable:!1,stateMutability:"nonpayable",type:"function"}],address:"0xc608e05ab2c5ecf8c3646697d0ca6969a0b8917e"},TwoKeyEconomy:{abi:[{constant:!0,inputs:[],name:"name",outputs:[{name:"",type:"string"}],payable:!1,stateMutability:"view",type:"function"},{constant:!1,inputs:[{name:"_spender",type:"address"},{name:"_value",type:"uint256"}],name:"approve",outputs:[{name:"",
type:"bool"}],payable:!1,stateMutability:"nonpayable",type:"function"},{constant:!0,inputs:[],name:"totalSupply",outputs:[{name:"",type:"uint256"}],payable:!1,stateMutability:"view",type:"function"},{constant:!1,inputs:[{name:"_from",type:"address"},{name:"_to",type:"address"},{name:"_value",type:"uint256"}],name:"transferFrom",outputs:[{name:"",type:"bool"}],payable:!1,stateMutability:"nonpayable",type:"function"},{constant:!0,inputs:[],name:"decimals",outputs:[{name:"",type:"uint8"}],payable:!1,
stateMutability:"view",type:"function"},{constant:!1,inputs:[{name:"_spender",type:"address"},{name:"_subtractedValue",type:"uint256"}],name:"decreaseApproval",outputs:[{name:"",type:"bool"}],payable:!1,stateMutability:"nonpayable",type:"function"},{constant:!0,inputs:[{name:"_owner",type:"address"}],name:"balanceOf",outputs:[{name:"",type:"uint256"}],payable:!1,stateMutability:"view",type:"function"},{constant:!1,inputs:[],name:"renounceOwnership",outputs:[],payable:!1,stateMutability:"nonpayable",
type:"function"},{constant:!0,inputs:[],name:"owner",outputs:[{name:"",type:"address"}],payable:!1,stateMutability:"view",type:"function"},{constant:!0,inputs:[],name:"symbol",outputs:[{name:"",type:"string"}],payable:!1,stateMutability:"view",type:"function"},{constant:!1,inputs:[{name:"_to",type:"address"},{name:"_value",type:"uint256"}],name:"transfer",outputs:[{name:"",type:"bool"}],payable:!1,stateMutability:"nonpayable",type:"function"},{constant:!1,inputs:[{name:"_spender",type:"address"},
{name:"_addedValue",type:"uint256"}],name:"increaseApproval",outputs:[{name:"",type:"bool"}],payable:!1,stateMutability:"nonpayable",type:"function"},{constant:!0,inputs:[{name:"_owner",type:"address"},{name:"_spender",type:"address"}],name:"allowance",outputs:[{name:"",type:"uint256"}],payable:!1,stateMutability:"view",type:"function"},{constant:!1,inputs:[{name:"_newOwner",type:"address"}],name:"transferOwnership",outputs:[],payable:!1,stateMutability:"nonpayable",type:"function"},{inputs:[],payable:!1,
stateMutability:"nonpayable",type:"constructor"},{anonymous:!1,inputs:[{indexed:!0,name:"previousOwner",type:"address"}],name:"OwnershipRenounced",type:"event"},{anonymous:!1,inputs:[{indexed:!0,name:"previousOwner",type:"address"},{indexed:!0,name:"newOwner",type:"address"}],name:"OwnershipTransferred",type:"event"},{anonymous:!1,inputs:[{indexed:!0,name:"owner",type:"address"},{indexed:!0,name:"spender",type:"address"},{indexed:!1,name:"value",type:"uint256"}],name:"Approval",type:"event"},{anonymous:!1,
inputs:[{indexed:!0,name:"from",type:"address"},{indexed:!0,name:"to",type:"address"},{indexed:!1,name:"value",type:"uint256"}],name:"Transfer",type:"event"}],address:"0x524793585665ee82712b7c8ebda6d85de8cadf52"},TwoKeyReg:{abi:[{constant:!0,inputs:[{name:"",type:"address"}],name:"owner2name",outputs:[{name:"",type:"string"}],payable:!1,stateMutability:"view",type:"function"},{constant:!0,inputs:[{name:"",type:"bytes32"}],name:"name2owner",outputs:[{name:"",type:"address"}],payable:!1,stateMutability:"view",
type:"function"},{anonymous:!1,inputs:[{indexed:!1,name:"owner",type:"address"},{indexed:!1,name:"name",type:"string"}],name:"UserNameChanged",type:"event"},{constant:!1,inputs:[{name:"_name",type:"string"}],name:"addName",outputs:[],payable:!1,stateMutability:"nonpayable",type:"function"},{constant:!0,inputs:[{name:"_name",type:"string"}],name:"getName2Owner",outputs:[{name:"",type:"address"}],payable:!1,stateMutability:"view",type:"function"},{constant:!0,inputs:[{name:"_owner",type:"address"}],
name:"getOwner2Name",outputs:[{name:"",type:"string"}],payable:!1,stateMutability:"view",type:"function"}],address:"0xed0758061c692f58100a7eeac8c5a813386bdf4d"}};