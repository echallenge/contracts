import {IExchangeETHUSD} from "./interfaces";
import {ITwoKeyBase, ITwoKeyHelpers} from "../interfaces";
import {ITwoKeyUtils} from "../utils/interfaces";

export default class ExchangeETH implements IExchangeETHUSD {
    private readonly base: ITwoKeyBase;
    private readonly helpers: ITwoKeyHelpers;
    private readonly utils: ITwoKeyUtils;

    constructor(twoKeyProtocol: ITwoKeyBase, helpers: ITwoKeyHelpers, utils: ITwoKeyUtils) {
        this.base = twoKeyProtocol;
        this.helpers = helpers;
        this.utils = utils;
    }

}
