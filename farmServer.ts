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
    "eggplant_seed": 1,
    "tomato_seed": 2,
    "sunflower_seed": 8,
    "strawberry_seed": 4,
    "vegetable_seeds": 10,
    "common_fertilizer": 5,
    "uncommon_fertilizer": 10,
}
//itemBuyIds[]
handlers.buy = try_catch(function (args, context) {
    let result: PlayFabServerModels.GrantItemsToUserResult = null;
    if (args.needRefresh == true) {
        let result = server.GetStoreItems({ StoreId: "storeA" });
        if (result && result.Store) {
            for (let i in result.Store) {
                prices[result.Store[i].ItemId] = result.Store[i].VirtualCurrencyPrices.GD;
            }
        }
        for (let i in result.Store) {
            prices[result.Store[i].ItemId] = result.Store[i].VirtualCurrencyPrices.GD;
        }
    }
    if (args && args.itemBuyIds) {
        let grantProductRequest: PlayFabServerModels.GrantItemsToUserRequest = {
            PlayFabId: currentPlayerId,
            ItemIds: args.itemBuyIds,
            Annotation: "buy",
        };
        result = server.GrantItemsToUser(grantProductRequest);
        if (result && result.ItemGrantResults) {
            let subVCRequest: PlayFabServerModels.SubtractUserVirtualCurrencyRequest = {
                PlayFabId: currentPlayerId,
                VirtualCurrency: "GD",
                Amount: 0,
            }
            for (let i in args.itemBuyIds) {
                let price = prices[args.itemBuyIds[i]];
                subVCRequest.Amount += price;
            }
            server.SubtractUserVirtualCurrency(subVCRequest);
        }
    }
    return { Result: result ? result : "buy OK" };
})
//itemBuys[id]
handlers.buy2 = try_catch(function (args, context) {
    let result: PlayFabServerModels.GrantItemsToUserResult = null;
    if (args.needRefresh == true) {
        let result = server.GetStoreItems({ StoreId: "storeA" });
        if (result && result.Store) {
            for (let i in result.Store) {
                prices[result.Store[i].ItemId] = result.Store[i].VirtualCurrencyPrices.GD;
            }
        }
        for (let i in result.Store) {
            prices[result.Store[i].ItemId] = result.Store[i].VirtualCurrencyPrices.GD;
        }
    }
    let subVCRequest: PlayFabServerModels.SubtractUserVirtualCurrencyRequest = {
        PlayFabId: currentPlayerId,
        VirtualCurrency: "GD",
        Amount: 0,
    }
    if (args && args.itemBuys) {
        let items = [];
        for (let ind in args.itemBuys) {
            items.push(ind);
            subVCRequest.Amount += args.itemBuys[ind] * prices[ind];
        }
        let grantProductRequest: PlayFabServerModels.GrantItemsToUserRequest = {
            PlayFabId: currentPlayerId,
            ItemIds: items,
            Annotation: "buy",
        };
        result = server.GrantItemsToUser(grantProductRequest);
        if (result && result.ItemGrantResults) {
            let usesToAdd = {};
            for (let i in result.ItemGrantResults) {
                if (args.itemBuys[result.ItemGrantResults[i].ItemId] > 1) {
                    if (result.ItemGrantResults[i].BundleContents) {
                        for (let j in result.ItemGrantResults[i].BundleContents) {
                            if (usesToAdd[result.ItemGrantResults[i].BundleContents[j]]) {
                                usesToAdd[result.ItemGrantResults[i].BundleContents[j]] += args.itemBuys[result.ItemGrantResults[i].ItemId] - 1
                            } else {
                                usesToAdd[result.ItemGrantResults[i].BundleContents[j]] = args.itemBuys[result.ItemGrantResults[i].ItemId] - 1
                            }
                        }
                    } else {
                        if (usesToAdd[result.ItemGrantResults[i].ItemId]) {
                            usesToAdd[result.ItemGrantResults[i].ItemId] += args.itemBuys[result.ItemGrantResults[i].ItemId] - 1
                        } else {
                            usesToAdd[result.ItemGrantResults[i].ItemId] = args.itemBuys[result.ItemGrantResults[i].ItemId] - 1
                        }
                    }
                }
            }
            for (let i in result.ItemGrantResults) {
                if (usesToAdd[result.ItemGrantResults[i].ItemId]) {
                    let req = {
                        PlayFabId: currentPlayerId,
                        ItemInstanceId: result.ItemGrantResults[i].ItemInstanceId,
                        UsesToAdd: usesToAdd[result.ItemGrantResults[i].ItemId],
                    };
                    result.ItemGrantResults[i].RemainingUses += usesToAdd[result.ItemGrantResults[i].ItemId];
                    result.ItemGrantResults[i].UsesIncrementedBy += usesToAdd[result.ItemGrantResults[i].ItemId];
                    server.ModifyItemUses(req);
                }
            }
            server.SubtractUserVirtualCurrency(subVCRequest);
        }
    }
    return { Result: result && result.ItemGrantResults ? { ItemGrantResults: result.ItemGrantResults, Price: subVCRequest.Amount } : "buy2 OK" };
})

//soilUpdates[instanceId]{species,plantTime,acceleration},itemConsumes[id]{instanceId,consumeCount},itemGrants[]{id}
handlers.syncData = try_catch(function (args, context) {
    if (args && args.soilUpdates) {
        for (let ind in args.soilUpdates) {
            let updateSoilRequest: PlayFabServerModels.UpdateUserInventoryItemDataRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: ind,
                Data: { "species": args.soilUpdates[ind].species, "plantTime": args.soilUpdates[ind].plantTime, "acceleration": args.soilUpdates[ind].acceleration },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
    }
    if (args && args.itemConsumes) {
        for (let ind in args.itemConsumes) {
            let consumeRequest: PlayFabServerModels.ConsumeItemRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.itemConsumes[ind].instanceId,
                ConsumeCount: args.itemConsumes[ind].consumeCount,
            }
            server.ConsumeItem(consumeRequest);
        }
    }
    let result: PlayFabServerModels.GrantItemsToUserResult = null;
    if (args && args.itemGrants) {
        let grantProductRequest: PlayFabServerModels.GrantItemsToUserRequest = {
            PlayFabId: currentPlayerId,
            ItemIds: args.itemGrants,
            Annotation: "sync data",
        };
        result = server.GrantItemsToUser(grantProductRequest);
    }
    return { Result: result ? result : "sync OK" };
})



//soilInstanceIds=[],productIds[]
handlers.harvest = try_catch(function (args, context) {
    let result: PlayFabServerModels.GrantItemsToUserResult = null;
    if (args && args.soilInstanceIds && args.productIds) {
        let grantProductRequest: PlayFabServerModels.GrantItemsToUserRequest = {
            PlayFabId: currentPlayerId,
            ItemIds: args.productIds,
            Annotation: "harvest",
        };
        result = server.GrantItemsToUser(grantProductRequest);
        for (let i in args.soilInstanceIds) {
            let updateSoilRequest: PlayFabServerModels.UpdateUserInventoryItemDataRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.soilInstanceIds[i],
                Data: { "species": null, "plantTime": null, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
    }
    return { Result: result ? result : "harvest OK" };
})


//soilSows[]{instanceId,species,plantTime} seeds[]{instanceId,consumeCount}
handlers.sow = try_catch(function (args, context) {
    if (args && args.soilSows && args.seeds) {
        for (let i in args.soilSows) {
            let updateSoilRequest: PlayFabServerModels.UpdateUserInventoryItemDataRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.soilSows[i].instanceId,
                Data: { "species": args.soilSows[i].species, "plantTime": args.soilSows[i].plantTime, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
        for (let i in args.seeds) {
            let consumeRequest: PlayFabServerModels.ConsumeItemRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.seeds[i].instanceId,
                ConsumeCount: args.seeds[i].consumeCount,
            }
            server.ConsumeItem(consumeRequest);
        }
    }
    return { Result: "sow OK" };
})

// soilInstanceIds=[]
handlers.eradicate = try_catch(function (args, context) {
    if (args && args.soilInstanceIds) {
        for (let i in args.soilInstanceIds) {
            let updateSoilRequest: PlayFabServerModels.UpdateUserInventoryItemDataRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.soilInstanceIds[i],
                Data: { "species": null, "plantTime": null, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
    }
    return { Result: "eradicate OK" };
})

//soilAccelerates:[]{instanceId,acceleration}, fertilizers:[]{instanceId,consumeCount}
handlers.accelerate = try_catch(function (args, context) {
    if (args && args.soilAccelerates && args.fertilizers) {
        for (let ind in args.soilAccelerates) {
            let updateSoilRequest: PlayFabServerModels.UpdateUserInventoryItemDataRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.soilAccelerates[ind].instanceId,
                Data: { "acceleration": args.soilAccelerates[ind].acceleration },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
        for (let ind in args.fertilizers) {
            let consumeRequest: PlayFabServerModels.ConsumeItemRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.fertilizers[ind].instanceId,
                ConsumeCount: args.fertilizers[ind].consumeCount,
            }
            server.ConsumeItem(consumeRequest);
        }
    }
    return { Result: "accelerate OK" };
})

//update leaderboard
handlers.PopulateLeaderboard = try_catch(function (args, context) {
    let getUserInventoryRequest: PlayFabServerModels.GetUserInventoryRequest = {
        PlayFabId: currentPlayerId,
    };
    let result = server.GetUserInventory(getUserInventoryRequest);
    if (result && result.VirtualCurrency) {
        server.UpdatePlayerStatistics({
            PlayFabId: currentPlayerId,
            Statistics: [
                {
                    "StatisticName": "GD",
                    "Value": result.VirtualCurrency.GD,
                }
            ]
        });
    }
});


handlers.helloWorld = try_catch(function (args, context) {

    let message = "Hello " + currentPlayerId + "!";

    log.info(message);
    let inputValue = null;
    if (args && args.inputValue)
        inputValue = args.inputValue;
    log.debug("helloWorld:", { input: args.inputValue });

    return { messageValue: message };
})

//itemSells=[]{instanceId, id, consumeCount }
handlers.sell = try_catch(function (args, context) {
    if (args && args.itemSells) {
        let catalogItem = [];
        if (args.needRefresh == true) {
            let getCatalogItemsRequest = {
                CatalogVersion: "main"
            };
            let result = server.GetCatalogItems(getCatalogItemsRequest);
            if (result && result.Catalog) {
                for (let ind in result.Catalog) {
                    catalogItem[result.Catalog[ind].ItemId] = {
                        price: result.Catalog[ind].VirtualCurrencyPrices,
                    }
                }
            }
        }
        for (let ind in args.itemSells) {
            let price = args.needRefresh == true ? catalogItem[args.itemSells[ind].id].price.GD : prices[args.itemSells[ind].id];
            let addVCRequest: PlayFabServerModels.AddUserVirtualCurrencyRequest = {
                PlayFabId: currentPlayerId,
                VirtualCurrency: "GD",
                Amount: args.itemSells[ind].consumeCount * price,
            }
            server.AddUserVirtualCurrency(addVCRequest);
            let consumeRequest: PlayFabServerModels.ConsumeItemRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.itemSells[ind].instanceId,
                ConsumeCount: args.itemSells[ind].consumeCount,
            }
            server.ConsumeItem(consumeRequest);
        }
    }
    return { Result: "sell OK" };
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

