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
};
//soilInstanceIds=[],productIds[]
handlers.harvest = try_catch(function (args, context) {
    if (args && args.soilInstanceIds && args.productIds) {
        let grantProductRequest = {
            PlayFabId: currentPlayerId,
            ItemIds: args.productIds,
            Annotation: "harvest",
        };
        server.GrantItemsToUser(grantProductRequest);
        for (let i in args.soilInstanceIds) {
            let updateSoilRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.soilInstanceIds[i],
                Data: { "species": null, "plantTime": null, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
    }
    return { Result: "harvest OK" };
});
//soilSows[{instanceId,species,plantTime}] seeds[{instanceId,consumeCount}]
handlers.sow = try_catch(function (args, context) {
    if (args && args.soilSows && args.seeds) {
        for (let i in args.soilSows) {
            let updateSoilRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.soilSows[i].instanceId,
                Data: { "species": args.soilSows[i].species, "plantTime": args.soilSows[i].plantTime, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
        for (let i in args.seeds) {
            let consumeRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.seeds[i].instanceId,
                ConsumeCount: args.seeds[i].consumeCount,
            };
            server.ConsumeItem(consumeRequest);
        }
    }
    return { Result: "sow OK" };
});
// soilInstanceIds=[]
handlers.eradicate = try_catch(function (args, context) {
    if (args && args.soilInstanceIds) {
        for (let i in args.soilInstanceIds) {
            let updateSoilRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.soilInstanceIds[i],
                Data: { "species": null, "plantTime": null, "acceleration": "0" },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
    }
    return { Result: "eradicate OK" };
});
//soilAccelerates:[{instanceId,acceleration}], fertilizers:[{instanceId,consumeCount]}
handlers.accelerate = try_catch(function (args, context) {
    if (args && args.soilAccelerates) {
        for (let ind in args.soilAccelerates) {
            let updateSoilRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.soilAccelerates[ind].instanceId,
                Data: { "acceleration": args.soilAccelerates[ind].acceleration },
            };
            server.UpdateUserInventoryItemCustomData(updateSoilRequest);
        }
        for (let ind in args.fertilizers) {
            let consumeRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.fertilizers[ind].instanceId,
                ConsumeCount: args.fertilizers[ind].consumeCount,
            };
            server.ConsumeItem(consumeRequest);
        }
    }
    return { Result: "accelerate OK" };
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
//itemSells=[{instanceId, id, consumeCount }]
handlers.sell = try_catch(function (args, context) {
    if (args && args.itemSells) {
        let catalogItem = [];
        if (args.needRefresh == true) {
            let getCatalogItemsRequest = {
                CatalogVersion: "main"
            };
            let result = server.GetCatalogItems(getCatalogItemsRequest);
            if (result) {
                for (let ind in result.Catalog) {
                    catalogItem[result.Catalog[ind].ItemId] = {
                        price: result.Catalog[ind].VirtualCurrencyPrices,
                    };
                }
            }
        }
        for (let ind in args.itemSells) {
            let price = args.needRefresh == true ? catalogItem[args.itemSells[ind].id].price.GD : prices[args.itemSells[ind].id];
            let addVCRequest = {
                PlayFabId: currentPlayerId,
                VirtualCurrency: "GD",
                Amount: args.itemSells[ind].consumeCount * price,
            };
            server.AddUserVirtualCurrency(addVCRequest);
            let consumeRequest = {
                PlayFabId: currentPlayerId,
                ItemInstanceId: args.itemSells[ind].instanceId,
                ConsumeCount: args.itemSells[ind].consumeCount,
            };
            server.ConsumeItem(consumeRequest);
        }
    }
    return { Result: "sell OK" };
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
