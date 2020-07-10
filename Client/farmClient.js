/// <reference path="../node_modules/playfab-web-sdk/src/Typings/PlayFab/PlayFabClientApi.d.ts" />
/// <reference path="../node_modules/phaser/types/phaser.d.ts" />
/// <reference path="../node_modules/playfab-web-sdk/src/Typings/Playfab/Playfab.d.ts" />
'use strict';


var config = {
    type: Phaser.AUTO,
    width: 1260,
    height: 720,
    physics: {
        "default": 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};
var customId = null;
var player;
var game = new Phaser.Game(config);
var _context;
var growthStageTime = new Array(30, 80, 150);
var opreationType = 1;
var currentSelectedItem;
var playFabId;

var userSoil = [];
var userFertilizer = [];
var userProduct = [];
var userSeed = [];
var userProps = [];
var userVirtualCurrency = { GD: 0 };
var allSpecies = ['tomato', 'eggplant', 'sunflower', 'strawberry'];
var allTypeOfFertilizer = ['common_fertilizer', 'uncommon_fertilizer'];
var treasureChestLevel = ['gold', 'silver', 'bronze'];


var date;
var itemGrants = [];
var itemConsumes = {};
var soilUpdates = {};
var purchaseList = [];
var reqQueue = [];
var syncing = false;
var sellList = [];
var moneyNum;
var storeGroup = [];
var warehouseGroup = [];
var treasureChestGroup = [];
var catalogItem = [];
var storeItem = [];
var buttons = {};

function sync() {
    if (syncing) {
        alert("data syncing, please wait a moment and try again");
    } else {
        let req;
        if (reqQueue.length == 0) {
            if (Object.keys(soilUpdates).length + Object.keys(itemGrants).length + Object.keys(itemConsumes).length > 0) {
                req = {
                    FunctionName: "syncData",
                    RevisionSelection: "Live",
                    FunctionParameter: {
                        soilUpdates: Object.keys(soilUpdates).length > 0 ? soilUpdates : null,
                        itemGrants: Object.keys(itemGrants).length > 0 ? itemGrants : null,
                        itemConsumes: Object.keys(itemConsumes).length > 0 ? itemConsumes : null,
                    },
                    GeneratePlayStreamEvent: true
                }
                let str = JSON.stringify(itemConsumes);
                soilUpdates = {};
                itemConsumes = {};
                itemGrants = [];
                reqQueue.push(req);
            }
        } else {
            req = reqQueue[0];
        }
        if (req) {
            buttons["btn_sync"].disable();
            syncing = true;
            PlayFabClientSDK.ExecuteCloudScript(req, (result, error) => {
                syncing = false;
                logResult(result, error, function () {
                    reqQueue.shift();
                }, null)
                buttons["btn_sync"].enable();
            });
        }
    }
}

function preload() {
    PlayFab.settings.titleId = "168E0";
    _context = this;
    let srcs = ['background', 'slogan', 'warehouse', 'store', 'treasure_chest', 'sync_data',
        'nothing', 'soil_ready', 'soil_unready',
        'arrow', 'common_fertilizer', 'uncommon_fertilizer', 'spade', 'GD',
        'result_panel', 'store_background', 'add', 'sub', 'buy', 'sell', 'close', 'open',
        'vegetable_seeds',
    ];
    srcs = srcs.concat(allSpecies);
    srcs = srcs.concat(treasureChestLevel.map(tc => tc + '_treasure_chest'));
    srcs = srcs.concat(treasureChestLevel.map(tc => tc + '_key'));
    for (let i = 0; i < srcs.length; i++) {
        this.load.image(srcs[i], 'assets/' + srcs[i] + '.png');
    }
    allSpecies.map(sp => this.load.spritesheet(sp + '_seed', 'assets/' + sp + '_seed.png', { frameWidth: 100, frameHeight: 100 }));
}

function create() {
    //init background
    let sloganYL = 680;
    let sloganYH = 40;
    let sloganX = 630;
    let iconLeft = 200;
    let iconGap = 120;

    this.add.image(0, 0, 'background').setOrigin(0, 0).setDepth(-2);
    this.add.image(sloganX, sloganYH, 'slogan');
    this.add.image(sloganX, sloganYL, 'slogan');


    //init soil img
    for (let i = 0; i < 15; i++) {
        let x = Math.floor(i / 3);
        let y = i % 3;
        userSoil[i] = new Object();
        userSoil[i] = this.add.image(450 - 135 * y + 155 * x, 255 + 50 * y + 60 * x, 'soil_unready').setDepth(-1);
        userSoil[i].ready = false;
        userSoil[i].hasPlant = false;
        userSoil[i].species = null;
        userSoil[i].plantTime = null;
        userSoil[i].acceleration = 0;
        userSoil[i].plant = this.add.image(userSoil[i].x, userSoil[i].y - 15, 'nothing');
        userSoil[i].plant.depth = 2;
        userSoil[i].sow = function (_species) {
            this.species = _species;
            this.acceleration = 0;
            date = new Date();
            this.plantTime = date.getTime();
            this.plant.setTexture(_species + '_seed');
            this.hasPlant = true;

        };
        userSoil[i].eradicate = function () {
            this.species = null;
            this.plantTime = null;
            this.acceleration = 0;
            this.hasPlant = false;
            this.plant.setTexture('nothing');
        };

    }


    //init UI
    {

        //money icon
        this.add.image(iconLeft, sloganYH, 'GD');
        moneyNum = this.add.text(iconLeft + 25, sloganYH, 'GD:' + userVirtualCurrency.GD, { fontSize: '15px', fontWeight: 'bolder', fill: '#000' });

        //sync icon
        buttons["btn_sync"] = Button.createNew(this, iconLeft + iconGap * (3 + allSpecies.length), sloganYH, 'sync_data', 1, sync, true);



        for (let i = 0; i < allSpecies.length; i++) {
            //seed button
            userSeed[allSpecies[i] + '_seed'] = Item.createNew();
            ItemButtonWithUses.createNew(this, userSeed[allSpecies[i] + '_seed'], iconLeft + iconGap * (2 + allTypeOfFertilizer.length + i), sloganYL, allSpecies[i] + '_seed', 0.7, 15, 15, function () {
                player.setTexture(allSpecies[i] + '_seed');
                opreationType = 4 * Math.sign(opreationType);
                currentSelectedItem = allSpecies[i]
            })
            //product icon
            userProduct[allSpecies[i]] = Item.createNew();
            ItemIconWithUses.createNew(this, userProduct[allSpecies[i]], iconLeft + iconGap * (1.5 + i), sloganYH, allSpecies[i], 1, 25, 0);
        }

        //fertilizer button
        for (let i = 0; i < allTypeOfFertilizer.length; i++) {
            userFertilizer[allTypeOfFertilizer[i]] = Item.createNew();
            ItemButtonWithUses.createNew(this, userFertilizer[allTypeOfFertilizer[i]], iconLeft + iconGap * (2 + i), sloganYL, allTypeOfFertilizer[i], 0.7, 25, 15, function () {
                player.setTexture(allTypeOfFertilizer[i]);
                opreationType = 3 * Math.sign(opreationType);
                currentSelectedItem = allTypeOfFertilizer[i];
            });
        }

        //spade button
        Button.createNew(this, iconLeft + iconGap, sloganYL, 'spade', 1, function () {
            player.setTexture('spade');
            opreationType = 2 * Math.sign(opreationType);
        });

        //arrow button 
        Button.createNew(this, iconLeft, sloganYL, 'arrow', 1, function () {
            player.setTexture('nothing');
            opreationType = 1 * Math.sign(opreationType);
        });

        //player sprite
        player = this.physics.add.sprite(100, 450, 'nothing');
        player.depth = 10;
        player.setCollideWorldBounds(true);
    }

    //init userProps
    for (let i in treasureChestLevel) {
        userProps[treasureChestLevel[i] + '_treasure_chest'] = Item.createNew();
        userProps[treasureChestLevel[i] + '_key'] = Item.createNew();
    }
    //run
    self.setInterval("refreshPlant()", 1000);
    self.setInterval("sync()", 30000);
    while (!customId) {
        customId = prompt("Input Your Custom ID:", "").toUpperCase();
    }
    // customId = "FAN"
    login();

}

function update() {

    if (this.input.x > player.width / 2 && this.input.x < config.width - player.width / 2
        && this.input.y > player.height / 2 && this.input.y < config.height - player.height / 2) {
        player.x = this.input.x;
        player.y = this.input.y;
    }
}

function initStore() {

    storeGroup.push(_context.add.image(config.width / 2, config.height / 2, 'store_background').setScale(1.5));

    let i = 0;
    for (let ind in storeItem) {
        generateTradingItem(_context, "purchase", 420 + 130 * (i % 4), 220 + 150 * Math.floor(i / 4), ind)
        i++;
    }

    storeGroup.push(Button.createNew(_context, 800, 470, "buy", 1, function () {
        if (Object.keys(purchaseList).length > 0) {
            purchase(this);
        }
    }, true));

    storeGroup.push(Button.createNew(_context, 900, 150, "close", 1, function () {
        player.setScale(1);
        opreationType = Math.abs(opreationType);
        hideGroup(storeGroup);
        btn_store.enable();
    }))

    let btn_store = Button.createNew(_context, 200, 550, 'store', 1, function () {
        this.disable();
        showGroup(storeGroup);
        opreationType = -Math.abs(opreationType);
        player.setScale(0);

    }, true)

    hideGroup(storeGroup);
}

function initWarehouse() {

    warehouseGroup.push(_context.add.image(config.width / 2, config.height / 2, 'store_background').setScale(1.5));

    let i = 0;
    for (let ind in catalogItem) {
        if (catalogItem[ind].itemClass == "product") {
            generateTradingItem(_context, "sell", 420 + 130 * (i % 4), 280 + 150 * Math.floor(i / 4), ind);
            i++;
        }
    }

    let btn_sell = Button.createNew(_context, 800, 470, "sell", 1, function () {
        if (Object.keys(sellList).length > 0) {
            sell(this);
        }
    }, true)
    warehouseGroup.push(btn_sell);

    warehouseGroup.push(Button.createNew(_context, 900, 150, "close", 1, function () {
        player.setScale(1);
        opreationType = Math.abs(opreationType);
        hideGroup(warehouseGroup);
        btn_warehouse.enable();
    }))

    let btn_warehouse = Button.createNew(_context, 100, 550, 'warehouse', 1, function () {
        this.disable();
        sync();
        let i = 0;
        function checkSyncStatus() {
            setTimeout(() => {
                i++;
                if (syncing || Object.keys(soilUpdates).length + Object.keys(itemGrants).length + Object.keys(itemConsumes).length > 0) {
                    if (i > 8) {
                        alert("Data synchronization timed out, please restart the game");
                        return;
                    }
                    checkSyncStatus();
                } else {
                    showGroup(warehouseGroup)
                    player.setScale(0);
                    opreationType = - Math.abs(opreationType);
                    btn_sell.disable();
                    getInventory(function () {
                        btn_sell.enable();
                    });
                }
            }, 500);
        }
        checkSyncStatus();
    }, true);
    hideGroup(warehouseGroup);

}

function initTreasureChest() {

    treasureChestGroup.push(_context.add.image(config.width / 2, config.height / 2, 'store_background').setScale(1.5));
    let result_panel = Button.createNew(_context, config.width / 2, config.height / 2, 'result_panel', 2.5, function () {
        setResultVisible(false);
    })
    let result_text = _context.add.text(config.width / 2, config.height / 2-20, "", { fontSize: '20px', fill: '#000000' }).setOrigin(0.5,0.5);
    function setResultVisible(visible) {
        result_panel.setDepth(visible ? 6 : -5);
        if (visible) {
            result_panel.setInteractive();
        } else {
            result_panel.disableInteractive();
        }
        result_text.setDepth(visible ? 7 : -5);
    }
    setResultVisible(false);

    for (let i = 0; i < treasureChestLevel.length; i++) {
        let treasureChestId = treasureChestLevel[i] + '_treasure_chest';
        let keyId = treasureChestLevel[i] + '_key';
        let x = 450 + 180 * (i % 4);
        let y = 250;
        treasureChestGroup.push(ItemIconWithUses.createNew(_context, userProps[treasureChestId], x, y, treasureChestId, 1, -10, 45));
        treasureChestGroup.push( ItemIconWithUses.createNew(_context, userProps[keyId], x, y + 120, keyId, 1, -10, 45));
        treasureChestGroup.push(Button.createNew(_context, x, y + 220, "open", 1, function () {
            if (userProps[treasureChestId].count > 0 && userProps[keyId].count > 0) {
                this.disable();
                PlayFabClientSDK.UnlockContainerItem({ "ContainerItemId": treasureChestId }, (result, error) => {
                    this.enable();
                    logResult(result, error, function () {
                        let str = "Congratulations, you got:\n"
                        for (let i = 0; i < result.data.GrantedItems.length; i++) {
                            userSeed[result.data.GrantedItems[i].ItemId].modifyCount(result.data.GrantedItems[i].UsesIncrementedBy);
                            userSeed[result.data.GrantedItems[i].ItemId].instanceId = result.data.GrantedItems[i].ItemInstanceId;
                            str += "\n\t" + result.data.GrantedItems[i].UsesIncrementedBy + '\t' + result.data.GrantedItems[i].DisplayName;
                        }
                        userProps[treasureChestId].modifyCount(-1);
                        userProps[keyId].modifyCount(-1);
                        result_text.setText(str);
                        setResultVisible(true);
                    }, null)
                })
            } else {
                let x = userProps[_chest.itemId].count <= 0 ? _chest.itemId : _key.itemId
                alert("You don't have enough " + x);
            }
        }, true));
    }
    
    treasureChestGroup.push(Button.createNew(_context, 900, 150, "close", 1, function () {
        player.setScale(1);
        opreationType = Math.abs(opreationType);
        hideGroup(treasureChestGroup);
        btn_treasure_chest.enable();
    }))

    let btn_treasure_chest = Button.createNew(_context, 100, 450, 'treasure_chest', 1, function () {
        this.disable();
        showGroup(treasureChestGroup);
        opreationType = -Math.abs(opreationType);
        player.setScale(0);

    }, true)

    hideGroup(treasureChestGroup);
}

function purchase(btn_purchase) {

    date = new Date();
    let now = date.getTime();
    let price = 0;
    btn_purchase.disable()
    //////buy2
    let buyReq = {
        FunctionName: "buy2",
        RevisionSelection: "Live",
        FunctionParameter: {
            "itemBuys": {},
        },
        GeneratePlayStreamEvent: true
    }
    for (let ind in purchaseList) {
        buyReq.FunctionParameter.itemBuys[ind] = purchaseList[ind];
        price += purchaseList[ind] * storeItem[ind].price.GD;
    }
    if (price > userVirtualCurrency.GD) {
        alert("no enough GD!");
        btn_purchase.enable();
        return;
    }
    PlayFabClientSDK.ExecuteCloudScript(buyReq, (result, error) => {
        btn_purchase.enable();
        logResult(result, error, function () {
            for (let i in result.data.FunctionResult.Result.ItemGrantResults) {
                let item = result.data.FunctionResult.Result.ItemGrantResults[i];
                if (item.ItemClass == 'seed') {
                    if (userSeed[item.ItemId]) {
                        userSeed[item.ItemId].modifyCount(item.UsesIncrementedBy);
                        userSeed[item.ItemId].instanceId = item.ItemInstanceId;
                    }
                } else if (item.ItemClass == 'fertilizer') {
                    if (userFertilizer[item.ItemId]) {
                        userFertilizer[item.ItemId].modifyCount(item.UsesIncrementedBy);
                        userFertilizer[item.ItemId].instanceId = item.ItemInstanceId;
                    }
                }
                storeGroup[item.ItemId].setText(" " + 0 + " ");
                delete purchaseList[item.ItemId]
            }

            userVirtualCurrency.GD -= result.data.FunctionResult.Result.Price;
            moneyNum.setText('GD: ' + userVirtualCurrency.GD);
            date = new Date();
            console.log(date.getTime() - now);
            alert("successful purchased ");
        }, null);
    })

}
function sell(btn_sell) {
    let income = 0;
    btn_sell.disable();
    let sellReq = {
        FunctionName: "sell",
        RevisionSelection: "Live",
        FunctionParameter: {
            "needRefresh": true,
            "itemSells": [],
        },
        GeneratePlayStreamEvent: true
    }
    for (let ind in sellList) {
        sellReq.FunctionParameter.itemSells.push({
            "id": ind,
            "instanceId": userProduct[ind].instanceId,
            "consumeCount": sellList[ind],
        });
        income += sellList[ind] * catalogItem[ind].price.GD;
    }
    PlayFabClientSDK.ExecuteCloudScript(sellReq, (result, error) => {
        btn_sell.enable();
        logResult(result, error, function () {
            for (let ind in sellList) {
                userProduct[ind].modifyCount(-sellList[ind]);
                warehouseGroup[ind].setText(" " + 0 + " ");
                delete sellList[ind];
            }
            userVirtualCurrency.GD += income;
            moneyNum.setText('GD: ' + userVirtualCurrency.GD);
        }, null);
    })
}


//get price,itemClass,customeData of catalog items
//index
//catalogItem: itemId
function getCatalogItem() {
    let _catalogItem = [];
    let getCatalogItemsRequest = {
        CatalogVersion: "main"
    };
    PlayFabClientSDK.GetCatalogItems(getCatalogItemsRequest, (result, error) => logResult(result, error, function () {
        for (let ind in result.data.Catalog) {
            let item = result.data.Catalog[ind];
            let customData = void 0;
            if (item.CustomData) {
                try {
                    customData = JSON.parse(item.CustomData);
                }
                catch (error) { } 
            }
            _catalogItem[item.ItemId] = {
                price: item.VirtualCurrencyPrices,
                itemClass: item.ItemClass,
                customData: customData,
            }
        }
        catalogItem = _catalogItem;
        initWarehouse();
    }, null));
};

function initSoil() {
    for (let i = 0; i < userSoil.length; i++) {
        let child = userSoil[i];
        if (child.ready) {
            child.plant.inputEnabled = true;
            child.plant.setInteractive();
            child.plant.on('pointerdown', function () {
                if (child.hasPlant) {
                    if (opreationType == 1) {
                        alert("growtime: " + child.plantTime);
                    }
                    else if (opreationType == 2) {
                        date = new Date();
                        let growTime = (date.getTime() - child.plantTime) / 1000;
                        growTime = parseFloat(growTime) + parseInt(child.acceleration);
                        if (growTime > growthStageTime[2]) {
                            userProduct[child.species].modifyCount( 5);
                            itemGrants.push(child.species + '_product')
                        }
                        child.eradicate();
                        soilUpdates[child.instanceId] = {
                            species: null,
                            plantTime: null,
                            acceleration: 0,
                        }

                    }
                    else if (opreationType == 3) {
                        let num = userFertilizer[currentSelectedItem].count;
                        if (num > 0) {
                            userFertilizer[currentSelectedItem].setCount(num - 1);
                            child.acceleration = parseInt(child.acceleration) + parseInt(catalogItem[currentSelectedItem].customData.acceleration);
                            updateGrowthStage(child);
                            soilUpdates[child.instanceId] = {
                                species: child.species,
                                plantTime: child.plantTime,
                                acceleration: child.acceleration,
                            }
                            if (itemConsumes[currentSelectedItem]) {
                                itemConsumes[currentSelectedItem].consumeCount++;
                            } else {
                                itemConsumes[currentSelectedItem] = {
                                    instanceId: userFertilizer[currentSelectedItem].instanceId,
                                    consumeCount: 1,
                                }
                            }
                        } else {
                            alert("no enough " + currentSelectedItem + " !");
                        }
                    }
                }
                else {
                    if (opreationType == 4) {
                        let num = userSeed[currentSelectedItem + '_seed'].count;
                        if (num > 0) {
                            userSeed[currentSelectedItem + '_seed'].modifyCount(-1);
                            child.sow(currentSelectedItem);
                            soilUpdates[child.instanceId] = {
                                species: child.species,
                                plantTime: child.plantTime,
                                acceleration: 0,
                            }
                            if (itemConsumes[child.species + '_seed']) {
                                itemConsumes[child.species + '_seed'].consumeCount++;
                            } else {
                                itemConsumes[child.species + '_seed'] = {
                                    instanceId: userSeed[child.species + '_seed'].instanceId,
                                    consumeCount: 1,
                                }
                            }
                        } else {
                            alert("no " + currentSelectedItem + " seeds!");
                        }
                    }
                }
            }, this);
        }
    }
}

function updateGrowthStage(child) {
    date = new Date();
    let now = date.getTime()
    let growTime = (now - child.plantTime) / 1000;
    growTime = parseFloat(growTime) + parseInt(child.acceleration);
    if (growTime >= growthStageTime[2]) {
        child.plant.setFrame(3);
    }
    else if (growTime >= growthStageTime[1]) {
        child.plant.setFrame(2);
    }
    else if (growTime >= growthStageTime[0]) {
        child.plant.setFrame(1);
    }
}

function refreshPlant() {
    for (let i = 0; i < userSoil.length; i++) {
        if (userSoil[i].hasPlant) {
            updateGrowthStage(userSoil[i]);
        }
    }
}

function login() {
    let loginRequest = {
        TitleId: "168E0",
        CustomId: customId,
        CreateAccount: true
    };
    PlayFabClientSDK.LoginWithCustomID(loginRequest, (result, error) => {
        if (result !== null) {
            if (result.data.NewlyCreated) {
                alert("Hello new friend, we have prepared a novice pacage for you! \nplease wait a moment")
            } else {
                alert("Welcome back " + customId);
            }
            playFabId = result.data.PlayFabId;
            setTimeout(function () {
                getInventory(function () {
                    initSoil();
                    initTreasureChest();
                });
            }, result.data.NewlyCreated ? 2000 : 0);
            getCatalogItem();
            getStoreItems();
        }
        else if (error !== null) {
            alert("Login Error:  " + PlayFab.GenerateErrorReport(error));
        }
    });
}

function logResult(result, error, funcSuccess, funcFailure) {
    if (error) {
        alert(PlayFab.GenerateErrorReport(error));
    } else if (result != null) {
        if (result.data.Error) {
            if (funcFailure) {
                funcFailure();
            } else {
                alert(result.data.Error.StackTrace);
            }
        } else {
            if (funcSuccess) {
                funcSuccess();
            }
        }
    }
}



//get instanceId,count,and soil status of user inventory
//index------
//userSoil: int
//userFertilizer,userSeed,userProduct:itemId
function getInventory(myCallback = null) {
    PlayFabClientSDK.GetUserInventory({}, (result, error) => logResult(result, error,
        function () {
            userVirtualCurrency = result.data.VirtualCurrency;
            moneyNum.setText('GD: ' + userVirtualCurrency.GD);
            let index = 0;
            for (let ind in result.data.Inventory) {
                let item = result.data.Inventory[ind];
                let customData;
                if (item.CustomData) {
                    customData = item.CustomData;
                }
                switch (item.ItemClass) {
                    case "soil":
                        userSoil[index].setTexture('soil_ready')
                        userSoil[index].ready = true;
                        userSoil[index].instanceId = item.ItemInstanceId;
                        if (customData && customData.species) {
                            userSoil[index].sow(customData.species);
                            userSoil[index].plantTime = customData.plantTime;
                            userSoil[index].acceleration = customData.acceleration;
                            updateGrowthStage(userSoil[index]);
                        }
                        index++;
                        break;
                    case "fertilizer":
                        userFertilizer[item.ItemId].instanceId = item.ItemInstanceId;
                        userFertilizer[item.ItemId].setCount(item.RemainingUses);
                        break;
                    case "seed":
                        userSeed[item.ItemId].instanceId = item.ItemInstanceId;
                        userSeed[item.ItemId].setCount(item.RemainingUses);
                        break;
                    case "product":
                        userProduct[item.ItemId].instanceId = item.ItemInstanceId;
                        userProduct[item.ItemId].setCount(item.RemainingUses);
                        break;
                    case "props":
                        userProps[item.ItemId].instanceId = item.ItemInstanceId;
                        userProps[item.ItemId].count = item.RemainingUses;
                        if (item.Container) {
                            userProps[item.itemId].keyItemId = item.Container.KeyItemId;
                        }
                        break;
                }

            }
            if (myCallback) {
                myCallback();
            }
        }, null));

}

//get price of store items
//index:-----
//storeItem:itemId
function getStoreItems() {
    PlayFabClientSDK.GetStoreItems({ StoreId: "storeA" }, (result, error) => logResult(result, error, function () {
        let index = 0;
        storeItem = [];
        for (let ind in result.data.Store) {
            let item = result.data.Store[ind];
            storeItem[item.ItemId] = {
                price: item.VirtualCurrencyPrices,
            };
        }
        initStore();
    }, null))
}


var Item = {
    createNew: function () {
        let item = {};
        item.count = 0;
        //显示其数量的标签
        item.usesLabels = [];
        item.setCount = function (_count = this.count) {
            this.count = _count;
            for (let i = 0; i < this.usesLabels.length; i++) {
                this.usesLabels[i].setText('x' + _count)
            }
        };
        item.modifyCount = function (_count) {
            this.setCount(this.count + _count)
        }
        return item
    }
}
var ItemIconWithUses = {
    createNew: function (_context, _linkedItem, x, y, texture, scale, textOffsetX, textOffsetY) {
        let icon = {};
        icon.image = _context.add.image(x, y, texture).setScale(scale);
        icon.text = _context.add.text(x + textOffsetX, y + textOffsetY, 'x' + _linkedItem.count, { fontSize: '15px', fill: '#000' })
        if (_linkedItem) {
            _linkedItem.usesLabels.push(icon.text)
        }
        icon.setDepth=function(depth){
            icon.image.setDepth(depth);
            icon.text.setDepth(depth);
        }
        return icon;
    }
}

var ItemButtonWithUses = {
    createNew: function (_context, _linkedItem, x, y, texture, scale, textOffsetX, textOffsetY, onClickFunc) {
        let button = ItemIconWithUses.createNew(_context, _linkedItem, x, y, texture, scale, textOffsetX, textOffsetY);
        button.image.inputEnabled = true;
        button.image.setInteractive();
        button.image.on('pointerdown', onClickFunc);
        return button;
    }
}

var Button = {
    createNew: function (_context, x, y, texture, scale, onClickFunc, needEnable = false) {
        let button = {};
        button = _context.add.image(x, y, texture).setScale(scale);
        button.inputEnabled = true;
        button.setInteractive();
        button.on('pointerdown', onClickFunc);
        if (needEnable) {
            button.disable = function () {
                this.disableInteractive();
                this.setTint(0x999999)
            }
            button.enable = function () {
                this.setInteractive();
                this.setTint(0xffffff);
            }
        }
        return button
    }
}

function generateTradingItem(_context, tradeType, x, y, id) {
    let target;
    let group;
    let price = 0;
    if (tradeType == "purchase") {
        target = purchaseList;
        group = storeGroup;
        price = storeItem[id].price.GD;
    }
    else if (tradeType == "sell") {
        target = sellList;
        group = warehouseGroup;
        price = catalogItem[id].price.GD;
    }

    //图像
    group.push(_context.add.image(x, y, id));
    //交易数目
    let _text = _context.add.text(x, y + 50, " " + 0 + " ", { backgroundColor: "#fff", fontSize: '15px', fill: '#000' }).setOrigin(0.5,0.5);
    _text.fontWeight = 'bolder';
    // group.push(_text);
    group[id] = _text;
    if (target[id]) {
        _text.setText(" " + target[id] + " ") //初始化
    }
    //价格
    let _price = _context.add.text(x, y + 80, " " + "GD: " + price, { fontSize: '15px', fill: '#fff' }).setOrigin(0.5,0);
    _price.fontWeight = 'bold';
    group.push(_price);
    //调整数目
    let op = ["sub", "add"];
    for (let i = 0; i < op.length; i++) {
        let _btn = _context.add.image(x + 40 * (i - 0.5), y + 50, op[i]);
        group.push(_btn);
        _btn.inputEnabled = true;
        let timeHandler;

        let changeNum = function () {
            let _count = (target[id] ? target[id] : 0) + 2 * (i - 0.5);
            _count = Math.min(tradeType == "sell" ? userProduct[id].count : (tradeType == "purchase" ? 100 : 0), _count)
            if (_count > 0) {
                target[id] = _count;
            } else {
                _count = 0;
                if (target[id]) {
                    delete target[id];
                }
            }
            _text.setText(" " + _count + " ")
            return changeNum;
        }
        _btn.on('pointerdown', function () {
            timeHandler = self.setInterval(changeNum(), 100);
        });
        _btn.on("pointerup", function () {
            self.clearInterval(timeHandler);
        })
        _btn.on("pointerout", function () {
            self.clearInterval(timeHandler);
        })
    }
}


function showGroup(group) {
    for (let i in group) {
        let child = group[i];
        if (child._events&&Object.keys(child._events).length > 0) {
            child.setInteractive();
        }
        child.setDepth(5);
    }
}
function hideGroup(group) {
    for (let i in group) {
        let child = group[i];
        if (child._events&&Object.keys(child._events).length > 0) {
            child.disableInteractive();
        }
        child.setDepth(-5);
    }
}