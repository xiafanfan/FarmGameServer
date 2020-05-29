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
var prices = {
    "eggplant": 1,
    "strawberry": 3,
    "sunflower": 5,
    "tomato": 2,
}



//items=[{soilInstanceId:string,productId:string}]
handlers.harvest = try_catch(function (args, context) {
    if (args && args.items) {
        for (let ind in args.items) {
            let soilInstanceId = args.items[ind].soilInstanceId;
            let productId = args.items[ind].productId;
            let updateSoilRequest: PlayFabServerModels.UpdateUserInventoryItemDataRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: soilInstanceId,
                Data: { "species": null, "plantTime": null, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
            let grantProductRequest: PlayFabServerModels.GrantItemsToUserRequest = {
                PlayFabId: currentPlayerId,
                ItemIds: productId,
                Annotation: "harvest",
            };
            server.GrantItemsToUser(grantProductRequest);
        }

    }

    return { Result: "harvest OK" };
})

//items=[{soilInstanceId:string,species:string,plantTime:number}]
handlers.sow = try_catch(function (args, context) {
    if (args && args.items) {
        for (let ind in args.items) {
            let soilInstanceId = args.items[ind].soilInstanceId;
            let species = args.items[ind].species;
            let plantTime = args.items[ind].plantTime;
            let seedInstanceId = args.items[ind].seedInstanceId;
            let updateSoilRequest: PlayFabServerModels.UpdateUserInventoryItemDataRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: soilInstanceId,
                Data: { "species": species, "plantTime": plantTime, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
            let consumeRequest: PlayFabServerModels.ConsumeItemRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: seedInstanceId,
                ConsumeCount: 1,
            }
            server.ConsumeItem(consumeRequest);
        }


    }
    return { Result: "sow OK" };
})

// items=[{soilInstanceId:string}]
handlers.eradicate = try_catch(function (args, context) {
    if (args && args.items) {
        for (let ind in args.items) {
            let soilInstanceId = args.items[ind].soilInstanceId;
            let updateSoilRequest: PlayFabServerModels.UpdateUserInventoryItemDataRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: soilInstanceId,
                Data: { "species": null, "plantTime": null, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
    }
    return {Result: "eradicate OK" };
})

//items={soils:[{soilInstanceId:string, acceleration:number}], fertilizers:[fertilizerInstanceId:string, consumeCount:number]}
handlers.accelerate = try_catch(function (args, context) {
    if (args && args.items.soils) {
        for (let ind in args.items.soils) {
            let soilInstanceId = args.items.soils[ind].soilInstanceId;
            let acceleration = args.items.soils[ind].acceleration;
            let updateSoilRequest: PlayFabServerModels.UpdateUserInventoryItemDataRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: soilInstanceId,
                Data: { "acceleration": acceleration },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
        for(let ind in args.items.fertilizers){
            let consumeRequest: PlayFabServerModels.ConsumeItemRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.items.fertilizers[ind].fertilizerInstanceId,
                ConsumeCount: args.items.fertilizers[ind].consumeCount,
            }
            server.ConsumeItem(consumeRequest);
        }
    }
    return { Result: "accelerate OK" };
})


handlers.helloWorld = try_catch(function (args, context) {

    let message = "Hello " + currentPlayerId + "!";

    log.info(message);
    let inputValue = null;
    if (args && args.inputValue)
        inputValue = args.inputValue;
    log.debug("helloWorld:", { input: args.inputValue });

    return { messageValue: message };
})

//items=[{itemInstanceId:string, itemId:string, count:number }]
handlers.sell = try_catch(function (args, context) {
    if (args && args.items) {
        let catalogItem = [];
        if (args.needRefresh == true) {
            let getCatalogItemsRequest = {
                CatalogVersion: "main"
            };
            let result = server.GetCatalogItems(getCatalogItemsRequest);
            if (result) {
                for (let ind in result.Catalog) {
                    let item = result.Catalog[ind];
                    catalogItem[item.ItemId] = {
                        price: item.VirtualCurrencyPrices,
                    }
                }
            }
        }
        for (let ind in args.items) {
            let itemInstanceId = args.items[ind].itemInstanceId;
            let itemId = args.items[ind].itemId;
            let count = args.items[ind].count;
            let consumeRequest: PlayFabServerModels.ConsumeItemRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: itemInstanceId,
                ConsumeCount: count,
            }
            server.ConsumeItem(consumeRequest);
            let price = args.needRefresh== true ? catalogItem[itemId].price.GD : prices[itemId];
            let addVCRequest: PlayFabServerModels.AddUserVirtualCurrencyRequest = {
                PlayFabId: currentPlayerId,
                VirtualCurrency: "GD",
                Amount: count * price,
            }
            server.AddUserVirtualCurrency(addVCRequest);
        }
    }

    return {Result: "sell OK" };
})

function try_catch(func) {
    return function (args, context) {
        try {
            return func(args, context)
        } catch (e) {
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
            })
            throw e
        }
    }
}

