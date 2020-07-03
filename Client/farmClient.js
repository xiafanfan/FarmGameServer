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
var growthStageTime = new Array(30, 80, 150);
var opreationType = 1;
var currentSelectedItem;
var playFabId;

var userSoil = [];
var userFertilizer = [];
var userProduct = [];
var userSeed = [];
var userProps = [];
// var userProps = {
//     treasureChest: [],
//     key: [],
// };
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
            buttons["btn_sync"].disableInteractive();
            buttons["btn_sync"].setTint(0x999999);
            syncing = true;
            PlayFabClientSDK.ExecuteCloudScript(req, (result, error) => {
                syncing = false;
                logResult(result, error, function () {
                    reqQueue.shift();
                }, null)
                buttons["btn_sync"].setInteractive();
                buttons["btn_sync"].setTint(0xffffff);
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
    // this.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });
}
function create() {
    //init background
    let sloganYL = 730;
    let sloganYH = 40;
    let sloganX = 630;
    let iconLeft = 200;
    let iconGap = 120;

    this.add.image(0, 0, 'background').setOrigin(0, 0);
    this.add.image(sloganX, sloganYH, 'slogan');
    this.add.image(sloganX, sloganYL, 'slogan');


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
        moneyNum = this.add.text(iconLeft + 25, sloganYH, 'GD:' + userVirtualCurrency.GD, { fontSize: '15px', fontWeight: 'bolder', fill: '#000' });

        //sync icon
        buttons["btn_sync"] = this.add.image(iconLeft + iconGap * (3 + allSpecies.length), sloganYH, 'sync_data').setScale(0.5).setInteractive().on('pointerdown', sync);

        for (let i = 0; i < allSpecies.length; i++) {
            //seed icon
            let _seed = this.add.image(iconLeft + iconGap * (2 + allTypeOfFertilizer.length + i), sloganYL, allSpecies[i] + '_seed').setScale(0.7);
            userSeed[allSpecies[i] + '_seed'] = { count: 0 };
            userSeed[allSpecies[i] + '_seed'].text = this.add.text(_seed.x + 15, _seed.y + 15, 'x' + userSeed[allSpecies[i] + '_seed'].count, { fontSize: '15px', fill: '#000' });
            userSeed[allSpecies[i] + '_seed'].setCount = function (_count) {
                this.count = _count;
                this.text.setText('x' + _count)
            };
            _seed.inputEnabled = true;
            _seed.setInteractive();
            _seed.on('pointerdown', function () {
                player.setTexture(allSpecies[i] + '_seed');
                opreationType = 4 * Math.sign(opreationType);
                currentSelectedItem = allSpecies[i]
            });


            //product icon
            userProduct[allSpecies[i]] = { count: 0 };
            this.add.image(iconLeft + iconGap * (1.5 + i), sloganYH, allSpecies[i]).setScale(0.5);
            userProduct[allSpecies[i]].text = this.add.text(iconLeft + 25 + iconGap * (1.5 + i), sloganYH, 'x' + userProduct[allSpecies[i]].count, { fontSize: '15px', fill: '#000' });
            userProduct[allSpecies[i]].setCount = function (_count) {
                this.count = _count;
                this.text.setText('x' + _count)
            };
        }
        //fertilizer icon
        for (let i = 0; i < allTypeOfFertilizer.length; i++) {
            userFertilizer[allTypeOfFertilizer[i]] = { count: 0 };
            let _fertilizer = this.add.image(iconLeft + iconGap * (2 + i), sloganYL, allTypeOfFertilizer[i]).setScale(0.5);
            userFertilizer[allTypeOfFertilizer[i]].text = this.add.text(_fertilizer.x + 25, _fertilizer.y + 15, 'x' + userFertilizer[allTypeOfFertilizer[i]].count, { fontSize: '15px', fill: '#000' });
            userFertilizer[allTypeOfFertilizer[i]].setCount = function (_count) { this.count = _count; this.text.setText('x' + _count) };
            _fertilizer.inputEnabled = true;
            _fertilizer.setInteractive();
            _fertilizer.on('pointerdown', function () {
                player.setTexture(allTypeOfFertilizer[i]);
                opreationType = 3 * Math.sign(opreationType);
                currentSelectedItem = allTypeOfFertilizer[i];
            });
        }
        //spade icon
        let buttonSpade = this.add.image(iconLeft + iconGap, sloganYL, 'spade').setScale(0.7);
        buttonSpade.inputEnabled = true;
        buttonSpade.setInteractive();
        buttonSpade.on('pointerdown', function () {
            player.setTexture('spade');
            opreationType = 2 * Math.sign(opreationType);
        });

        //arrow icon 
        this.add.image(iconLeft, sloganYL, 'arrow').setScale(0.5).setInteractive().on('pointerdown', function () {
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
        userProps[treasureChestLevel[i] + '_treasure_chest'] = { count: 0 };
        userProps[treasureChestLevel[i] + '_key'] = { count: 0 };
    }
    //run
    self.setInterval("refreshPlant()", 1000);
    self.setInterval("sync()", 30000);
    customId = prompt("Input Your Custom ID:", "user-01");
    login();
    // initTreasureChest();

}
function update() {
    // if (gameOver) {
    //     return;
    // }
    if (this.input.x > player.width / 2 && this.input.x < config.width - player.width / 2
        && this.input.y > player.height / 2 && this.input.y < config.height - player.height / 2) {
        player.x = this.input.x;
        player.y = this.input.y;
    }
}
function initStore() {

    let bg = _context.add.image(630, 392, 'store_background').setScale(1.5).setDepth(-1);
    storeGroup.push(bg);

    let i = 0;
    for (let ind in storeItem) {
        let _item = _context.add.image(420 + 130 * (i % 4), 260 + 150 * Math.floor(i / 4), ind).setDepth(-1).setScale(0.8);
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
        opreationType = Math.abs(opreationType);
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
        opreationType = -Math.abs(opreationType);
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
    warehouseGroup["btn_sell"] = btn_sell;

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
        opreationType = Math.abs(opreationType);
        for (let i in warehouseGroup) {
            let child = warehouseGroup[i];
            child.disableInteractive();
            child.setDepth(-1);

        }
    });

    let btn_warehouse = _context.add.image(100, 600, 'warehouse').setScale(0.5);
    btn_warehouse.inputEnabled = true;
    btn_warehouse.setInteractive();
    btn_warehouse.on('pointerdown', function () {
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
                    for (let i in warehouseGroup) {
                        let child = warehouseGroup[i];
                        child.setInteractive();
                        child.setDepth(5);
                    }
                    player.setScale(0);
                    opreationType = - Math.abs(opreationType);
                    warehouseGroup["btn_sell"].disableInteractive();
                    warehouseGroup["btn_sell"].setTint(0x999999);
                    getInventory(function () {
                        warehouseGroup["btn_sell"].setInteractive();
                        warehouseGroup["btn_sell"].setTint(0xffffff);
                    });
                }
            }, 500);
        }
        checkSyncStatus();
    });


}
function initTreasureChest() {

    let bg = _context.add.image(630, 392, 'store_background').setScale(1.5).setDepth(-1);
    let result_panel = _context.add.image(bg.x, bg.y, 'result_panel').setScale(2.5).setDepth(-1).setOrigin(0.5, 0.5);
    let result_text = _context.add.text(result_panel.x, result_panel.y - 30, "", { fontSize: '20px', fill: '#000000' }).setDepth(-1).setOrigin(0.5, 0.5);
    result_panel.setInteractive();
    result_panel.on('pointerdown', function () {
        result_panel.setDepth(-1);
        result_panel.disableInteractive();
        result_text.setDepth(-1);
    })
    treasureChestGroup.push(bg);
    for (let i = 0; i < treasureChestLevel.length; i++) {
        let _chest = _context.add.image(450 + 180 * (i % 4), 280, treasureChestLevel[i] + '_treasure_chest').setDepth(-1);
        Object.assign(_chest, {
            itemId: treasureChestLevel[i] + '_treasure_chest',
            inputEnabled: true,
        })
        let _chestText = _context.add.text(_chest.x, _chest.y + 60, "x" + userProps[_chest.itemId].count + " ", { fontSize: '20px' }).setDepth(-1).setOrigin(0.5, 0.5);
        _chestText.fontWeight = 'bolder';
        treasureChestGroup.push(_chestText);
        treasureChestGroup[_chest.itemId] = _chest;
        _chest.setCount = function (_count) {
            userProps[_chest.itemId].count = _count;
            _chestText.setText('x' + _count);
        };
        let _key = _context.add.image(450 + 180 * (i % 4), 400, treasureChestLevel[i] + '_key').setDepth(-1).setScale(0.7);
        Object.assign(_key, {
            itemId: treasureChestLevel[i] + '_key',
            inputEnabled: true,
        })
        let _keyText = _context.add.text(_key.x, _key.y + 60, "x" + userProps[_key.itemId].count + " ", { fontSize: '20px' }).setDepth(-1).setOrigin(0.5, 0.5);
        _keyText.fontWeight = 'bolder';
        treasureChestGroup.push(_keyText);
        treasureChestGroup[_key.itemId] = _key;
        _key.setCount = function (_count) {
            userProps[_key.itemId].count = _count;
            _keyText.setText('x' + _count);
        };
        let btn_open = _context.add.image(_key.x, _key.y + 100, "open").setDepth(-1).setScale(0.7);
        treasureChestGroup.push(btn_open);
        btn_open.on('pointerdown', function () {
            if (userProps[_chest.itemId].count > 0 && userProps[_key.itemId].count > 0) {
                btn_open.disableInteractive();
                btn_open.setTint(0x999999);
                PlayFabClientSDK.UnlockContainerItem({ "ContainerItemId": _chest.itemId }, (result, error) => {
                    btn_open.setInteractive();
                    btn_open.setTint(0xffffff);
                    logResult(result, error, function () {
                        let str = "Congratulations, you got:\n"
                        for (let i = 0; i < result.data.GrantedItems.length; i++) {
                            userSeed[result.data.GrantedItems[i].ItemId].setCount(result.data.GrantedItems[i].RemainingUses);
                            userSeed[result.data.GrantedItems[i].ItemId].instanceId = result.data.GrantedItems[i].ItemInstanceId;
                            str += "\n\t" + result.data.GrantedItems[i].UsesIncrementedBy + '\t' + result.data.GrantedItems[i].DisplayName;
                        }
                        _chest.setCount(userProps[_chest.itemId].count - 1);
                        _key.setCount(userProps[_key.itemId].count - 1);
                        result_panel.setDepth(6);
                        result_text.setText(str);
                        result_text.setDepth(6);
                        result_panel.setInteractive();
                    }, null)
                })
            } else {
                let x = userProps[_chest.itemId].count <= 0 ? _chest.itemId : _key.itemId
                alert("You don't have enough " + x);
            }
        });
    }


    let btn_close = _context.add.image(900, 200, "close").setDepth(-1);
    btn_close.inputEnabled = true;
    treasureChestGroup.push(btn_close);
    btn_close.on('pointerdown', function () {
        player.setScale(1);
        opreationType = Math.abs(opreationType);
        for (let i in treasureChestGroup) {
            let child = treasureChestGroup[i];
            child.disableInteractive();
            child.setDepth(-1);

        }
    });

    let btn_treasure_chest = _context.add.image(100, 500, 'treasure_chest').setScale(0.5);
    btn_treasure_chest.inputEnabled = true;
    btn_treasure_chest.setInteractive();
    btn_treasure_chest.on('pointerdown', function () {
        player.setScale(0);
        opreationType = - Math.abs(opreationType);
        for (let i in treasureChestGroup) {
            let child = treasureChestGroup[i];
            child.setInteractive();
            child.setDepth(5);
        }
    });
}
function purchase(btn_purchase) {
    date = new Date();
    let now = date.getTime();
    let price = 0;
    console.log("try purchase");
    btn_purchase.disableInteractive();
    console.log("disable interact");
    btn_purchase.setTint(0x999999);
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
        btn_purchase.setInteractive();
        btn_purchase.setTint(0xffffff);
        return;
    }
    PlayFabClientSDK.ExecuteCloudScript(buyReq, (result, error) => {
        btn_purchase.setInteractive();
        btn_purchase.setTint(0xffffff);
        logResult(result, error, function () {
            for (let i in result.data.FunctionResult.Result.ItemGrantResults) {
                let item = result.data.FunctionResult.Result.ItemGrantResults[i];
                if (item.ItemClass == 'seed') {
                    if (userSeed[item.ItemId]) {
                        userSeed[item.ItemId].setCount(item.RemainingUses);
                    }
                } else if (item.ItemClass == 'fertilizer') {
                    if (userFertilizer[item.ItemId]) {
                        userFertilizer[item.ItemId].setCount(item.RemainingUses);
                    }
                }
                storeGroup[item.ItemId].setCount(0);
            }
            purchaseList = [];
            userVirtualCurrency.GD -= result.data.FunctionResult.Result.Price;
            moneyNum.setText('GD: ' + userVirtualCurrency.GD);
            date = new Date();
            console.log(date.getTime() - now);
            alert("successful purchased ");
        }, null);
    })

    ////////////////////buy
    // let buyReq = {
    //     FunctionName: "buy",
    //     RevisionSelection: "Live",
    //     FunctionParameter: {
    //         "itemBuyIds": [],
    //     },
    //     GeneratePlayStreamEvent: true
    // }
    // for (let ind in purchaseList) {
    //     for (let i = 0; i < purchaseList[ind]; i++) {
    //         buyReq.FunctionParameter.itemBuyIds.push(ind);
    //     }
    //     price += purchaseList[ind] * storeItem[ind].price.GD;
    // }
    // if (price > userVirtualCurrency.GD) {
    //     alert("no enough GD!");
    //     btn_purchase.setInteractive();
    //     btn_purchase.setTint(0xffffff);
    //     return;
    // }
    // PlayFabClientSDK.ExecuteCloudScript(buyReq, (result, error) => {
    //     btn_purchase.setInteractive();
    //     btn_purchase.setTint(0xffffff);
    //     logResult(result, error, function () {
    //         for (let i in result.data.FunctionResult.Result.ItemGrantResults) {
    //             let item = result.data.FunctionResult.Result.ItemGrantResults[i];
    //             if (item.ItemClass == 'seed') {
    //                 if (userSeed[item.ItemId]) {
    //                     userSeed[item.ItemId].setCount(item.RemainingUses);
    //                 }
    //             } else if (item.ItemClass == 'fertilizer') {
    //                 if (userFertilizer[item.ItemId]) {
    //                     userFertilizer[item.ItemId].setCount(item.RemainingUses);
    //                 }
    //             }
    //             storeGroup[item.ItemId].setCount(0);
    //         }
    //         purchaseList = [];
    //         userVirtualCurrency.GD -= price;
    //         moneyNum.setText('GD: ' + userVirtualCurrency.GD);
    //         date = new Date();
    //         console.log(date.getTime() - now);
    //         alert("successful purchased ");
    //     }, null);
    // })

    ////////////////purchase
    // let purchaseReq = {
    //     "CatalogVersion": "main",
    //     "StoreId": "storeA",
    //     "Items": []
    // }
    // for (let ind in purchaseList) {
    //     purchaseReq.Items.push({
    //         "ItemId": ind,
    //         "Quantity": purchaseList[ind],
    //     })
    // }
    // PlayFabClientSDK.StartPurchase(purchaseReq, (result, error) => {
    //     if (result !== null) {
    //         let payReq = {
    //             "OrderId": result.data.OrderId,
    //             "ProviderName": result.data.PaymentOptions[0].ProviderName,
    //             "Currency": result.data.PaymentOptions[0].Currency
    //         }
    //         price = result.data.PaymentOptions[0].Price;
    //         PlayFabClientSDK.PayForPurchase(payReq, (result, error) => {
    //             if (result !== null) {
    //                 let payReq = {
    //                     "OrderId": result.data.OrderId,
    //                 }
    //                 PlayFabClientSDK.ConfirmPurchase(payReq, (result, error) => {
    //                     if (result !== null) {
    //                         for (let ind in result.data.Items) {
    //                             if (result.data.Items[ind].ItemClass == 'seed') {
    //                                 if (userSeed[result.data.Items[ind].ItemId]) {
    //                                     userSeed[result.data.Items[ind].ItemId].setCount(result.data.Items[ind].RemainingUses);
    //                                 }
    //                             } else if (result.data.Items[ind].ItemClass == 'fertilizer') {
    //                                 if (userFertilizer[result.data.Items[ind].ItemId]) {
    //                                     userFertilizer[result.data.Items[ind].ItemId].setCount(result.data.Items[ind].RemainingUses);
    //                                 }
    //                             }
    //                             storeGroup[result.data.Items[ind].ItemId].setCount(0);
    //                         }
    //                         purchaseList = [];
    //                         userVirtualCurrency.GD -= price;
    //                         moneyNum.setText('GD: ' + userVirtualCurrency.GD);
    //                         date=new Date();
    //                         console.log(date.getTime()-now);
    //                         btn_purchase.setTint(0xffffff);
    //                         btn_purchase.setInteractive();
    //                         alert("successful purchased ");
    //                     } else if (error !== null) {
    //                         alert("ConfirmPurchase Error:  " + PlayFab.GenerateErrorReport(error));
    //                         btn_purchase.setTint(0xffffff);
    //                         btn_purchase.setInteractive();
    //                     }
    //                 })
    //             }
    //             else if (error !== null) {
    //                 alert("PayForPurchase Error:  " + PlayFab.GenerateErrorReport(error));
    //                 btn_purchase.setTint(0xffffff);
    //                 btn_purchase.setInteractive();
    //             }
    //         });


    //     }
    //     else if (error !== null) {
    //         alert("StartPurchase Error:  " + PlayFab.GenerateErrorReport(error));
    //         btn_purchase.setTint(0xffffff);
    //         btn_purchase.setInteractive();
    //     }

    // });

}
function sell(btn_sell) {
    let income = 0;
    btn_sell.disableInteractive();
    btn_sell.setTint(0x999999);
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
        btn_sell.setInteractive();
        btn_sell.setTint(0xffffff);
        logResult(result, error, function () {
            for (let ind in sellList) {
                userProduct[ind].setCount(userProduct[ind].count - sellList[ind]);
                warehouseGroup[ind].setCount(0);
            }
            userVirtualCurrency.GD += income;
            moneyNum.setText('GD: ' + userVirtualCurrency.GD);
            sellList = [];
        }, null);
    })
}


//get price,itemClass,customeData of catalog items
//index
//catalogItem: itemId
function getCatalogItem(args, context) {
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
                            userProduct[child.species].setCount(userProduct[child.species].count += 5);
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
                            userSeed[currentSelectedItem + '_seed'].setCount(num - 1);
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
            if(result.data.NewlyCreated){
                setTimeout(
                    alert("Hello new friend, we have prepared a novice pacage for you!"),2000
                )             
            }else{
                alert("Welcome back " + customId);
            }
            playFabId = result.data.PlayFabId;
            getInventory(function () {
                initSoil();
                initTreasureChest();
            });
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

// function LogResult(result, error) {
//     if (error) {
//         alert(PlayFab.GenerateErrorReport(error));
//     } else if (result != null) {
//         if (result.data.Error) {
//             alert(result.data.Error.StackTrace);
//         } else {
//             alert(" successful");
//         }
//     }
// }
function ExecuteHelloWorld() {
    let req = {
        FunctionName: "helloWorld",
        RevisionSelection: "Specific",
        SpecificRevision: 1,
        // FunctionParameter: {
        //    inputValue: "123",
        // },
        GeneratePlayStreamEvent: true
    }
    PlayFabClientSDK.ExecuteCloudScript(req, (result, error) => logResult(result, error, function () { alert("ok") }, function () { alert(result.data.Error.Error) }));
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
