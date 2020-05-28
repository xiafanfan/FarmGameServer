/// <reference path="../node_modules/playfab-web-sdk/src/Typings/PlayFab/PlayFabClientApi.d.ts" />
/// <reference path="../node_modules/phaser/types/phaser.d.ts" />
/// <reference path="../node_modules/playfab-web-sdk/src/Typings/Playfab/Playfab.d.ts" />
'use strict';


var config = {
    type: Phaser.AUTO,
    width: 1260,
    height: 784,
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
var customId = "user-01";
var player;
var game = new Phaser.Game(config);
var _context;
var storeItem = [];
var growthStageTime = new Array(30, 80, 150);
var opreationType = 1;
var currentSpecies;
var playFabId;

var userSoil = [];
var userFertilizer = [];
var userProduct = [];
var userSeed = [];
var userVirtualCurrency = { GD: 0 };
var allSpecies = ['tomato', 'eggplant', 'sunflower', 'strawberry'];
var allTypeOfFertilizer = ['common_fertilizer', 'uncommon_fertilizer'];



var date;
var harvestRequest = [];
var sowRequest = [];
var eradicateRequest = [];
var accelerateRequest = [];
var purchaseList = [];
var sellList = [];
var soilOp = [];
var moneyNum;
var storeGroup = [];
var warehouseGroup = [];
var catalogItem = [];
function sync() {
    accelerate();
    sow();
    harvest();
    eradicate();
}


function preload() {
    _context = this;
    let srcs = ['background', 'slogan', 'warehouse', 'store',
        'nothing', 'soil_ready', 'soil_unready',
        'fertilizer', 'spade', 'GD',
        'store_background', 'add', 'sub', 'buy', 'sell', 'close',
        'vegetable_seeds',
    ];
    srcs = srcs.concat(allSpecies);
    for (let i = 0; i < srcs.length; i++) {
        this.load.image(srcs[i], 'assets/' + srcs[i] + '.png');
    }

    allSpecies.map(sp => this.load.spritesheet(sp + '_seed', 'assets/' + sp + '_seed.png', { frameWidth: 100, frameHeight: 100 }));
    this.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });
}
function create() {
    //init background
    let sloganYL = 730;
    let sloganYH = 40;
    let sloganX = 630;
    let iconLeft = 200;
    let iconGap = 130;

    this.add.image(0, 0, 'background').setOrigin(0, 0);
    this.add.image(sloganX, sloganYH, 'slogan')
    this.add.image(sloganX, sloganYL, 'slogan')


    //init soil img
    for (let i = 0; i < 15; i++) {
        let x = Math.floor(i / 3);
        let y = i % 3;
        userSoil[i] = new Object();
        userSoil[i] = this.add.image(450 - 135 * y + 155 * x, 285 + 50 * y + 60 * x, 'soil_unready');
        userSoil[i].ready = false;
        userSoil[i].hasPlant = false;
        userSoil[i].species = null;
        userSoil[i].plantTime = null;
        userSoil[i].acceleration = 0;
        userSoil[i].plant = this.add.image(450 - 135 * y + 155 * x, 270 + 50 * y + 60 * x, 'nothing');
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

    //init icon
    {

        //money icon
        this.add.image(iconLeft, sloganYH, 'GD').setScale(0.5);
        moneyNum = this.add.text(iconLeft + 25, sloganYH, 'GD:' + userVirtualCurrency.GD, { fontSize: '20px', fontWeight: 'bolder', fill: '#000' });

        for (let i = 0; i < allSpecies.length; i++) {
            //seed icon
            let _seed = this.add.image(iconLeft + iconGap * (3 + i), sloganYL, allSpecies[i] + '_seed');
            userSeed[allSpecies[i] + '_seed'] = { count: 0 };
            userSeed[allSpecies[i] + '_seed'].text = this.add.text(iconLeft + 35 + iconGap * (3 + i), sloganYL, 'x' + userSeed[allSpecies[i] + '_seed'].count, { fontSize: '20px', fontWeight: 'bolder', fill: '#000' });
            userSeed[allSpecies[i] + '_seed'].setCount = function (_count) {
                this.count = _count;
                this.text.setText('x' + _count)
            };
            _seed.inputEnabled = true;
            _seed.setInteractive();
            _seed.on('pointerdown', function () {
                player.setTexture(allSpecies[i] + '_seed');
                opreationType = 4 * Math.sign(opreationType);
                currentSpecies = allSpecies[i]
            }, this);


            //product icon
            userProduct[allSpecies[i]] = { count: 0 };
            this.add.image(iconLeft + iconGap * (2 + i), sloganYH, allSpecies[i]).setScale(0.5);
            userProduct[allSpecies[i]].text = this.add.text(iconLeft + 25 + iconGap * (2 + i), sloganYH, 'x' + userProduct[allSpecies[i]].count, { fontSize: '20px', fontWeight: 'bolder', fill: '#000' });
            userProduct[allSpecies[i]].setCount = function (_count) {
                this.count = _count;
                this.text.setText('x' + _count)
            };
        }


        userFertilizer['common_fertilizer'] = { count: 0 };
        //fertilizer icon
        let _fertilizer = this.add.image(iconLeft + iconGap * 2, sloganYL, 'fertilizer');
        userFertilizer['common_fertilizer'].text = this.add.text(iconLeft + 35 + iconGap * 2, sloganYL, 'x' + userFertilizer['common_fertilizer'].count, { fontSize: '20px', fontWeight: 'bolder', fill: '#000' });
        userFertilizer['common_fertilizer'].setCount = function (_count) { this.count = _count; this.text.setText('x' + _count) };
        _fertilizer.inputEnabled = true;
        _fertilizer.setInteractive();
        _fertilizer.on('pointerdown', function () {
            player.setTexture('fertilizer');
            opreationType = 3 * Math.sign(opreationType);
        }, this);

        //spade icon
        let buttonSpade = this.add.image(iconLeft + iconGap, sloganYL, 'spade');
        buttonSpade.inputEnabled = true;
        buttonSpade.setInteractive();
        buttonSpade.on('pointerdown', function () {
            player.setTexture('spade');
            opreationType = 2 * Math.sign(opreationType);
        }, this);

        //dude icon 
        let buttonDude = this.add.image(iconLeft, sloganYL, 'dude').setScale(1.5);
        buttonDude.inputEnabled = true;
        buttonDude.setInteractive();
        buttonDude.on('pointerdown', function () {
            player.setTexture('dude');
            sync();
            opreationType = 1 * Math.sign(opreationType);
        }, this);

        //dude sprite
        player = this.physics.add.sprite(100, 450, 'dude', 6);
        player.depth = 10;
        player.setCollideWorldBounds(true);
    }

    //run
    self.setInterval("refreshPlant()", 1000);
    self.setInterval("sync()", 30000);
    login();

}
function update() {
    // if (gameOver) {
    //     return;
    // }
    if (this.input.x > player.width && this.input.x < config.width - player.width
        && this.input.y > player.height && this.input.y < config.height - player.height) {
        player.x = this.input.x;
        player.y = this.input.y;
    }
}
function initStore() {

    let bg = _context.add.image(630, 392, 'store_background').setScale(1.5).setDepth(-1);
    storeGroup.push(bg);

    let i = 0;
    for (let ind in storeItem) {
        let _item = _context.add.image(420 + 130 * (i % 4), 260 + 150 * Math.floor(i / 4), ind).setDepth(-1);
        i++;
        Object.assign(_item, {
            itemId: ind,
            count: 0,
            inputEnabled: true,
        })

        let _text = _context.add.text(_item.x, _item.y + 50, " " + _item.count + " ", { backgroundColor: "#fff", fontSize: '15px', fill: '#000' }).setDepth(-1).setOrigin(0.5, 0.5);
        _text.fontWeight = 'bolder';
        storeGroup.push(_text);
        let _price = _context.add.text(_item.x, _item.y + 80, " " + "GD: " + storeItem[ind].price.GD, { fontSize: '15px', fill: '#fff' }).setDepth(-1).setOrigin(0.5, 0.5);
        _price.fontWeight = 'bold';
        storeGroup.push(_price);

        storeGroup[_item.itemId] = _item;
        _item.setCount = function (_count) {
            this.count = _count;
            _text.setText(' ' + _count + ' ');
        };
        let op = ["sub", "add"];
        for (let i = 0; i < op.length; i++) {
            let _btn = _context.add.image(_item.x + 40 * (i - 0.5), _item.y + 50, op[i]).setScale(0.3).setDepth(-1).setOrigin(0.5, 0.5);
            storeGroup.push(_btn);
            _btn.inputEnabled = true;
            let timeHandler;
            let changeNum = function () {
                let _count = _item.count + 2 * (i - 0.5);
                if (_count > 0) {
                    purchaseList[_item.itemId] = _count;
                } else {
                    _count = 0;
                    if (purchaseList[_item.itemId]) {
                        delete purchaseList[_item.itemId];
                    }
                }
                _item.setCount(_count);
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


    let btn_purchase = _context.add.image(800, 500, "buy").setDepth(-1);
    storeGroup.push(btn_purchase);

    btn_purchase.on('pointerdown', function () {
        for (let ind in purchaseList) {
            purchase(btn_purchase);
            break;
        }

    });

    let btn_close = _context.add.image(900, 200, "close").setDepth(-1);
    btn_close.inputEnabled = true;
    storeGroup.push(btn_close);
    btn_close.on('pointerdown', function () {
        player.setScale(1);
        opreationType *= -1;
        for (let i in storeGroup) {
            let child = storeGroup[i];
            child.disableInteractive();
            child.setDepth(-1);

        }
    });

    let btn_store = _context.add.image(200, 600, 'store').setScale(0.5);
    btn_store.inputEnabled = true;
    btn_store.setInteractive();
    btn_store.on('pointerdown', function () {
        opreationType *= -1;
        player.setScale(0);
        for (let i in storeGroup) {
            let child = storeGroup[i];
            child.setInteractive();
            child.setDepth(5);
        }
    });


}
function initWarehouse() {

    let bg = _context.add.image(630, 392, 'store_background').setScale(1.5).setDepth(-1);
    warehouseGroup.push(bg);

    let i = 0;
    for (let ind in catalogItem) {
        if (catalogItem[ind].itemClass == "product") {
            let _item = _context.add.image(420 + 130 * (i % 4), 260 + 150 * Math.floor(i / 4), ind).setDepth(-1).setScale(0.7);
            i++;
            Object.assign(_item, {
                itemId: ind,
                count: 0,
                inputEnabled: true,
            })

            let _text = _context.add.text(_item.x, _item.y + 50, " " + _item.count + " ", { backgroundColor: "#fff", fontSize: '15px', fill: '#000' }).setDepth(-1).setOrigin(0.5, 0.5);
            _text.fontWeight = 'bolder';
            warehouseGroup.push(_text);
            let _price = _context.add.text(_item.x, _item.y + 80, " " + "GD: " + catalogItem[ind].price.GD, { fontSize: '15px', fill: '#fff' }).setDepth(-1).setOrigin(0.5, 0.5);
            _price.fontWeight = 'bold';
            warehouseGroup.push(_price);

            warehouseGroup[_item.itemId] = _item;
            _item.setCount = function (_count) {
                this.count = _count;
                _text.setText(' ' + _count + ' ');
            };
            let op = ["sub", "add"];
            for (let i = 0; i < op.length; i++) {
                let _btn = _context.add.image(_item.x + 40 * (i - 0.5), _item.y + 50, op[i]).setScale(0.3).setDepth(-1).setOrigin(0.5, 0.5);
                warehouseGroup.push(_btn);
                _btn.inputEnabled = true;
                let timeHandler;
                let changeNum = function () {
                    let _count = _item.count + 2 * (i - 0.5);
                    if (_count > 0) {
                        if (userProduct[_item.itemId].count && _count <= userProduct[_item.itemId].count) {
                            sellList[_item.itemId] = _count;
                        } else {
                            _count = userProduct[_item.itemId].count;
                        }
                    } else {
                        _count = 0;
                        if (sellList[_item.itemId]) {
                            delete sellList[_item.itemId];
                        }
                    }
                    _item.setCount(_count);
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
    }


    let btn_sell = _context.add.image(800, 500, "sell").setDepth(-1);
    warehouseGroup.push(btn_sell);

    btn_sell.on('pointerdown', function () {
        for (let ind in sellList) {
            sell(btn_sell);
            break;
        }

    });

    let btn_close = _context.add.image(900, 200, "close").setDepth(-1);
    btn_close.inputEnabled = true;
    warehouseGroup.push(btn_close);
    btn_close.on('pointerdown', function () {
        player.setScale(1);
        opreationType *= -1;
        for (let i in warehouseGroup) {
            let child = warehouseGroup[i];
            child.disableInteractive();
            child.setDepth(-1);

        }
    });

    let btn_warehouse = _context.add.image(100, 600, 'warehouse').setScale(0.5);;
    btn_warehouse.inputEnabled = true;
    btn_warehouse.setInteractive();
    btn_warehouse.on('pointerdown', function () {
        player.setScale(0);
        opreationType *= -1;
        for (let i in warehouseGroup) {
            let child = warehouseGroup[i];
            child.setInteractive();
            child.setDepth(5);
        }
    });


}
function purchase(btn_buy) {
    let price;
    console.log("try purchase");
    btn_buy.disableInteractive();
    console.log("disable interact");
    btn_buy.setTint(0x999999);
    let purchaseReq = {
        "CatalogVersion": "main",
        "StoreId": "seed_store",
        "Items": []
    }
    for (let ind in purchaseList) {
        purchaseReq.Items.push({
            "ItemId": ind,
            "Quantity": purchaseList[ind],

        })
    }
    PlayFabClientSDK.StartPurchase(purchaseReq, (result, error) => {
        if (result !== null) {
            let payReq = {
                "OrderId": result.data.OrderId,
                "ProviderName": result.data.PaymentOptions[0].ProviderName,
                "Currency": result.data.PaymentOptions[0].Currency
            }
            price = result.data.PaymentOptions[0].Price;
            PlayFabClientSDK.PayForPurchase(payReq, (result, error) => {
                if (result !== null) {
                    let payReq = {
                        "OrderId": result.data.OrderId,
                    }
                    PlayFabClientSDK.ConfirmPurchase(payReq, (result, error) => {
                        if (result !== null) {
                            alert("successful purchased ");
                            for (let ind in result.data.Items) {
                                if (userSeed[result.data.Items[ind].ItemId]) {
                                    userSeed[result.data.Items[ind].ItemId].setCount(result.data.Items[ind].RemainingUses);
                                }
                                storeGroup[result.data.Items[ind].ItemId].setCount(0);
                            }
                            purchaseList = [];
                            userVirtualCurrency.GD -= price;
                            moneyNum.setText('GD: ' + userVirtualCurrency.GD);
                            btn_buy.setTint(0xffffff);
                            btn_buy.setInteractive();
                            console.log("en1")
                        } else if (error !== null) {
                            alert("ConfirmPurchase Error:  " + PlayFab.GenerateErrorReport(error));
                            btn_buy.setTint(0xffffff);
                            btn_buy.setInteractive();
                            console.log("en2")
                        }
                    })
                }

                else if (error !== null) {
                    alert("PayForPurchase Error:  " + PlayFab.GenerateErrorReport(error));
                    btn_buy.setTint(0xffffff);
                    btn_buy.setInteractive();
                    console.log("en3")
                }
            });


        }
        else if (error !== null) {
            alert("StartPurchase Error:  " + PlayFab.GenerateErrorReport(error));
            btn_buy.setTint(0xffffff);
            btn_buy.setInteractive();
        }

    });

}
function sell(btn_sell) {

    let income=0;
    console.log("try sell");
    btn_sell.disableInteractive();
    console.log("disable interact");
    btn_sell.setTint(0x999999);
    let sellReq = {
        FunctionName:"sell",
        RevisionSelection:"Live",
        FunctionParameter:{
            "sellRequest":[],
        },
        GeneratePlayStreamEvent:true
    }
    for (let ind in sellList) {
        sellReq.FunctionParameter.sellRequest.push({
            "itemId": ind,
            "itemInstanceId":userProduct[ind].instanceId,
            "count": sellList[ind],
        });
        income+=sellList[ind]*catalogItem[ind].price.GD;
    }
    PlayFabClientSDK.ExecuteCloudScript(sellReq, (result, error)=>{
        if (result != null) {
            for (let ind in sellList) {
                userProduct[ind].setCount(userProduct[ind].count-sellList[ind]);
                warehouseGroup[ind].setCount(0);
            }
            userVirtualCurrency.GD += income;
            moneyNum.setText('GD: ' + userVirtualCurrency.GD);
            sellList=[];
        }
        else if (error != null) {
            alert(PlayFab.GenerateErrorReport(error));
        }
        btn_sell.setTint(0xffffff);
        btn_sell.setInteractive();
    });


}
function updateCatalogItem(args, context) {
    let _catalogItem = [];
    let getCatalogItemsRequest = {
        CatalogVersion: "main"
    };
    PlayFabClientSDK.GetCatalogItems(getCatalogItemsRequest, function (result, error) {
        if (result != null) {
            for (let ind in result.data.Catalog) {
                let item = result.data.Catalog[ind];
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
                }
            }
            catalogItem = _catalogItem;
            initWarehouse();
        }
        else if (error != null) {
            alert(PlayFab.GenerateErrorReport(error));
        }
    });
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
                        if (soilOp[child.instanceId]) {
                            eval(soilOp[child.instanceId] + "()");
                        }
                        date = new Date();
                        let growTime = (date.getTime() - child.plantTime) / 1000;
                        growTime = parseFloat(growTime) + parseInt(child.acceleration);
                        if (growTime > growthStageTime[2]) {
                            userProduct[child.species].count += 5;
                            userProduct[child.species].text.setText('x' + userProduct[child.species].count);
                            harvestRequest.push({
                                soilInstanceId: child.instanceId,
                                productId: child.species + '_product'
                            });
                            soilOp[child.instanceId] = "harvest"
                        } else {
                            eradicateRequest.push({
                                soilInstanceId: child.instanceId,
                            });
                            soilOp[child.instanceId] = "eradicate";
                        }
                        child.eradicate();
                    }
                    else if (opreationType == 3) {
                        let num = userFertilizer['common_fertilizer'].count;
                        if (num > 0) {
                            if (soilOp[child.instanceId] && soilOp[child.instanceId] != accelerate) {
                                eval(soilOp[child.instanceId] + "()");
                            }
                            userFertilizer['common_fertilizer'].setCount(num - 1);
                            child.acceleration = parseInt(child.acceleration) + 80;
                            updateGrowthStage(child);
                            soilOp[child.instanceId] = "accelerate";
                            if (accelerateRequest) {
                                for (let i in accelerateRequest) {
                                    if (accelerateRequest[i].instanceId == child.instanceId) {
                                        accelerateRequest[i].consumeCount++;
                                        return;
                                    }

                                }
                            }
                            accelerateRequest.push({
                                soilInstanceId: child.instanceId,
                                acceleration: child.acceleration,
                                fertilizerInstanceId: userFertilizer['common_fertilizer'].instanceId,
                                consumeCount: 1
                            });


                        } else {
                            alert("no common fertilizer!");
                        }
                    }
                }
                else {
                    if (opreationType == 4) {
                        let num = userSeed[currentSpecies + '_seed'].count;
                        if (num > 0) {
                            if (soilOp[child.instanceId]) {
                                eval(soilOp[child.instanceId] + "()");
                            }
                            userSeed[currentSpecies + '_seed'].setCount(num - 1);
                            child.sow(currentSpecies);
                            sowRequest.push({
                                soilInstanceId: child.instanceId,
                                species: child.species,
                                plantTime: child.plantTime,
                                seedInstanceId: userSeed[currentSpecies + '_seed'].instanceId
                            })
                            soilOp[child.instanceId] = "sow";
                        } else {
                            alert("no " + currentSpecies + " seeds!");
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
            alert("Welcome " + customId);
            playFabId = result.data.PlayFabId;
            getInventory();
            updateCatalogItem();
            getStoreItems();
        }
        else if (error !== null) {
            alert("Login Error:  " + PlayFab.GenerateErrorReport(error));
        }
    });
}

function LogResult(result, error) {
    if (result != null) {
        // alert(" successful");
    }
    else if (error != null) {
        alert(PlayFab.GenerateErrorReport(error));
    }
}
// function ExecuteHelloWorld() {
    //     let req = {
    //         FunctionName: "helloWorld",
    //         RevisionSelection: "Live",
    //         FunctionParameter: {
    //             inputValue: "123",
    //         }
    //     }

    //    let result= PlayFabClientSDK.ExecuteCloudScript(req, LogResult);
    //    if(result){
    //        alert("ol")
    //    }else{
    //        alert("false")
    //    }

// }

function getCatalogItem() {
    let req = {
        FunctionName: "pullCatalogItem",
        RevisionSelection: "Live",
    }
    PlayFabClientSDK.ExecuteCloudScript(req, (result, error) => {
        if (result != null) {
            catalogItem = result.data.FunctionResult.CatalogItem;
        }
        else if (error != null) {
            alert(PlayFab.GenerateErrorReport(error));
        }
    });
}

function getInventory() {
    PlayFabClientSDK.GetUserInventory({}, updateUserInventory);
}

function getStoreItems() {
    PlayFabClientSDK.GetStoreItems({ StoreId: "seed_store" }, (result, error) => {
        if (result !== null) {
            let index = 0;
            storeItem = [];
            for (let ind in result.data.Store) {
                let item = result.data.Store[ind];
                storeItem[item.ItemId] = {
                    price: item.VirtualCurrencyPrices,
                };

            }
            initStore();
        }
        else if (error !== null) {
            alert("GetStoreItem Error:  " + PlayFab.GenerateErrorReport(error));
        }
    })
}
function updateUserInventory(result, error) {

    if (result != null) {
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
                    soilOp[item.ItemInstanceId] = null;
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
                    if (item.ItemId == 'common_fertilizer') {
                        userFertilizer[item.ItemId].instanceId = item.ItemInstanceId;
                        userFertilizer[item.ItemId].setCount(item.RemainingUses);// = { count: item.RemainingUses };
                    }
                    break;
                case "seed":
                    userSeed[item.ItemId].instanceId = item.ItemInstanceId;
                    userSeed[item.ItemId].setCount(item.RemainingUses);
                    break;
                case "product":
                    userProduct[item.ItemId].instanceId = item.ItemInstanceId;
                    userProduct[item.ItemId].setCount(item.RemainingUses);
                    break;

            }

        }
        initSoil();

    }
    else if (error != null) {
        alert(PlayFab.GenerateErrorReport(error));
    }
}


function harvest() {
    if (harvestRequest.length > 0) {
        for (let i in harvestRequest) {
            soilOp[harvestRequest[i].instanceId] = null;
        }
        let req = {
            FunctionName: "harvest",
            RevisionSelection: "Live",
            FunctionParameter: {
                harvestRequest: harvestRequest
            },
            GeneratePlayStreamEvent: true
        }
        PlayFabClientSDK.ExecuteCloudScript(req, LogResult);
        harvestRequest = [];
    }

}
function sow() {
    if (sowRequest.length > 0) {
        for (let i in sowRequest) {
            soilOp[sowRequest[i].instanceId] = null;
        }
        let req = {
            FunctionName: "sow",
            RevisionSelection: "Live",
            FunctionParameter: {
                sowRequest: sowRequest
            },
            GeneratePlayStreamEvent: true
        }
        PlayFabClientSDK.ExecuteCloudScript(req, LogResult);
        sowRequest = [];
    }

}
function eradicate() {

    if (eradicateRequest.length > 0) {
        for (let i in eradicateRequest) {
            soilOp[eradicateRequest[i].instanceId] = null;
        }
        let req = {
            FunctionName: "eradicate",
            RevisionSelection: "Live",
            FunctionParameter: {
                eradicateRequest: eradicateRequest
            },
            GeneratePlayStreamEvent: true
        }
        PlayFabClientSDK.ExecuteCloudScript(req, LogResult);
        eradicateRequest = [];
    }

}
function accelerate() {
    if (accelerateRequest.length > 0) {
        for (let i in accelerateRequest) {
            soilOp[accelerateRequest[i]] = null;
        }
        let req = {
            FunctionName: "accelerate",
            RevisionSelection: "Live",
            FunctionParameter: {
                accelerateRequest: accelerateRequest
            },
            GeneratePlayStreamEvent: true
        }
        PlayFabClientSDK.ExecuteCloudScript(req, LogResult);
        accelerateRequest = [];
    }
}
