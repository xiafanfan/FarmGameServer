// / <reference path="./node_modules/playfab-web-sdk/src/Typings/PlayFab/PlayFabServerApi.d.ts" />
// / <reference path="./node_modules/playfab-web-sdk/src/Typings/Playfab/Playfab.d.ts" />
/// <reference path="../node_modules/cloud-script/CloudScript.d.ts" />
/// <reference path="../node_modules/cloud-script/PlayStream.d.ts" />
///////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Welcome to your first Cloud Script revision!
//
// Cloud Script runs in the PlayFab cloud and has full access to the PlayFab Game Server API 
// (https://api.playfab.com/Documentation/Server), and it runs in the context of a securely
// authenticated player, so you can use it to implement logic for your game that is safe from
// client-side exploits. 
//
// Cloud Script functions can also make web requests to external HTTP
// endpoints, such as a database or private API for your title, which makes them a flexible
// way to integrate with your existing backend systems.
//
// There are several different options for calling Cloud Script functions:
//
// 1) Your game client calls them directly using the "ExecuteCloudScript" API,
// passing in the function name and arguments in the request and receiving the 
// function return result in the response.
// (https://api.playfab.com/Documentation/Client/method/ExecuteCloudScript)
// 
// 2) You create PlayStream event actions that call them when a particular 
// event occurs, passing in the event and associated player profile data.
// (https://api.playfab.com/playstream/docs)
// 
// 3) For titles using the Photon Add-on (https://playfab.com/marketplace/photon/),
// Photon room events trigger webhooks which call corresponding Cloud Script functions.
// 
// The following examples demonstrate all three options.
//
///////////////////////////////////////////////////////////////////////////////////////////////////////
// This is a Cloud Script function. "args" is set to the value of the "FunctionParameter" 
// parameter of the ExecuteCloudScript API.
// (https://api.playfab.com/Documentation/Client/method/ExecuteCloudScript)
// "context" contains additional information when the Cloud Script function is called from a PlayStream action.
"use strict";
var catalogItem = [];
handlers.updateCatalogItem = try_catch(function (args, context) {
    let _catalogItem = [];
    let getCatalogItemsRequest = {
        CatalogVersion: "main"
    };
    let result = server.GetCatalogItems(getCatalogItemsRequest);
    if (result) {
        for (let ind in result.Catalog) {
            let item = result.Catalog[ind];
            let customData = void 0;
            if (item.CustomData) {
                try {
                    customData = JSON.parse(item.CustomData);
                }
                catch (error) { }
                ;
            }
            _catalogItem[item.ItemId] = {
                price: item.VirtualCurrencyPrices,
                itemClass: item.ItemClass,
                customData: customData,
            };
        }
        catalogItem = _catalogItem;
    }
});
handlers.pullCatalogItem = try_catch(function (args, context) {
    return { CatalogItem: JSON.stringify(catalogItem) };
});
//harvestRequest=[{soilInstanceId:string,productId:string}]
handlers.harvest = try_catch(function (args, context) {
    if (args && args.harvestRequest) {
        for (let ind in args.harvestRequest) {
            let soilInstanceId = args.harvestRequest[ind].soilInstanceId;
            let productId = args.harvestRequest[ind].productId;
            let updateSoilRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: soilInstanceId,
                Data: { "species": null, "plantTime": null, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
            let grantProductRequest = {
                PlayFabId: currentPlayerId,
                ItemIds: productId,
                Annotation: "harvest",
            };
            server.GrantItemsToUser(grantProductRequest);
        }
    }
    return { harvestResult: "OK" };
});
//sowRequest=[{soilInstanceId:string,species:string,plantTime:number}]
handlers.sow = try_catch(function (args, context) {
    if (args && args.sowRequest) {
        for (let ind in args.sowRequest) {
            let soilInstanceId = args.sowRequest[ind].soilInstanceId;
            let species = args.sowRequest[ind].species;
            let plantTime = args.sowRequest[ind].plantTime;
            let seedInstanceId = args.sowRequest[ind].seedInstanceId;
            let updateSoilRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: soilInstanceId,
                Data: { "species": species, "plantTime": plantTime, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
            let consumeRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: seedInstanceId,
                ConsumeCount: 1,
            };
            server.ConsumeItem(consumeRequest);
        }
    }
    return { sowResult: "OK" };
});
// eradicateRequest=[{soilInstanceId:string}]
handlers.eradicate = try_catch(function (args, context) {
    let eradicateResult = [];
    if (args && args.eradicateRequest) {
        for (let ind in args.eradicateRequest) {
            let soilInstanceId = args.eradicateRequest[ind].soilInstanceId;
            let updateSoilRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: soilInstanceId,
                Data: { "species": null, "plantTime": null, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
    }
    return { eradicateResult: "OK" };
});
//accelerateRequest=[{soilInstanceId:string, fertilizerInstanceId:string, consumeCount:number, acceleration:number}]
handlers.accelerate = try_catch(function (args, context) {
    let accelerateResult = [];
    if (args && args.accelerateRequest) {
        for (let ind in args.accelerateRequest) {
            let soilInstanceId = args.accelerateRequest[ind].soilInstanceId;
            let acceleration = args.accelerateRequest[ind].acceleration;
            let fertilizerInstanceId = args.accelerateRequest[ind].fertilizerInstanceId;
            let consumeCount = args.accelerateRequest[ind].consumeCount;
            let updateSoilRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: soilInstanceId,
                Data: { "acceleration": acceleration },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
            let consumeRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: fertilizerInstanceId,
                ConsumeCount: consumeCount,
            };
            server.ConsumeItem(consumeRequest);
        }
    }
    return { accelerateResult: "OK" };
});
handlers.helloWorld = try_catch(function (args, context) {
    let message = "Hello " + currentPlayerId + "!";
    log.info(message);
    let inputValue = null;
    if (args && args.inputValue)
        inputValue = args.inputValue;
    log.debug("helloWorld:", { input: args.inputValue });
    return { messageValue: message };
});
//sellRequest=[{itemInstanceId:string, itemId:string, count:number }]
handlers.sell = try_catch(function (args, context) {
    if (args && args.sellRequest) {
        for (let ind in args.sellRequest) {
            let itemInstanceId = args.sellRequest[ind].itemInstanceId;
            let itemId = args.sellRequest[ind].itemId;
            let count = args.sellRequest[ind].count;
            let consumeRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: itemInstanceId,
                ConsumeCount: count,
            };
            server.ConsumeItem(consumeRequest);
            let addVCRequest = {
                PlayFabId: currentPlayerId,
                VirtualCurrency: "GD",
                Amount: count * catalogItem[itemId].price.GD,
            };
            server.AddUserVirtualCurrency(addVCRequest);
        }
    }
    return { sellResult: "OK" };
});
function try_catch(func) {
    return function (args, context) {
        try {
            return func(args, context);
        }
        catch (e) {
            server.WritePlayerEvent({
                "PlayFabId": currentPlayerId,
                "EventName": "playfab_error",
                "Body": {
                    "Exception": {
                        "Name": e.name,
                        "Message": e.message,
                        "Stack": e.stack
                    }
                }
            });
            throw e;
        }
    };
}
