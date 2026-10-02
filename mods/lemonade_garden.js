/* Lemonade Garden v1.0 - standalone Sandboxels mod.
 * Load this file through Mods; no game source changes or dependencies.
 * lg_ IDs keep this pack separate from other mods' lemons and lemonade.
 */
(function () {
    "use strict";
    if (elements.lg_lemon) return; // Avoid duplicate registration.

    const category = "lemonade";
    const waterTypes = ["water", "distilled_water"];
    const soils = ["dirt", "mud", "clay_soil", "mycelium", "grass"];
    const fruitTypes = ["lg_lemon", "lg_unripe_lemon", "lemon", "lemons", "lemon_slice", "lemon_slices"];
    const nearby = [[0, -1], [-1, 0], [1, 0], [0, 1]];

    function at(x, y) {
        return outOfBounds(x, y) ? null : pixelMap[x][y];
    }
    function comfortable(pixel) {
        return !pixel.burning && pixel.temp > 3 && pixel.temp < 45;
    }
    function register(id, name, definition) {
        elements["lg_" + id] = Object.assign({name: name, category: category}, definition);
    }
    function drink(name, color, extra) {
        // Copy the vanilla juice's existing environmental reactions without
        // changing juice itself. Recipes below take priority for our liquids.
        const reactions = Object.assign({}, elements.juice && elements.juice.reactions);
        delete reactions.sugar;
        delete reactions.seltzer;
        delete reactions.carbon_dioxide;
        return Object.assign({
            name: name, color: color, behavior: behaviors.LIQUID,
            category: category, state: "liquid", density: 1040,
            conduct: 0.03, isFood: true, extinguish: true,
            tempHigh: 105, stateHigh: ["steam", "steam", "sugar"],
            tempLow: -5, stateLow: "lg_lemonade_ice", reactions: reactions
        }, extra);
    }
    function addReaction(definition, ingredient, result, options) {
        if (!definition.reactions) definition.reactions = {};
        definition.reactions[ingredient] = Object.assign({
            elem1: result, elem2: null, chance: 0.15
        }, options);
    }

    register("lemon", "lemon", {
        color: ["#f5db35", "#ffe34a", "#eecb26"],
        behavior: behaviors.POWDER, state: "solid", density: 1050,
        hardness: 0.05, isFood: true, breakInto: "lg_lemon_juice",
        tempHigh: 150, stateHigh: "dead_plant",
        burn: 15, burnTime: 80, burnInto: ["steam", "ash"],
        reactions: {
            sugar: {elem1: "lg_candied_lemon", elem2: null, tempMin: 65, chance: 0.1}
        },
        desc: "Smash into lemon juice, or drop against a Lemon Juicer. Warm with Sugar above 65 C for candied lemon."
    });
    register("unripe_lemon", "unripe lemon", {
        color: ["#80ac35", "#abc53c"], behavior: behaviors.WALL,
        state: "solid", density: 1050, hardness: 0.05,
        isFood: true, breakInto: "lg_lemon_juice", properties: {age: 0},
        tempHigh: 100, stateHigh: "dead_plant",
        tempLow: -5, stateLow: "frozen_plant", burn: 20, burnTime: 70,
        tick: function (pixel) {
            if (!comfortable(pixel)) return;
            pixel.age++;
            const stem = at(pixel.x, pixel.y - 1);
            if (pixel.age >= 160 || !stem || stem.element !== "lg_lemon_leaves") {
                changePixel(pixel, "lg_lemon", false);
            }
        },
        desc: "Hangs below lemon leaves, ripens, then drops as a lemon. Use Lemon Harvest to pick early."
    });
    register("lemon_seed", "lemon seed", {
        color: ["#ddd39d", "#c7ba7b"], state: "solid", density: 1300,
        seed: true, properties: {age: 0},
        tempHigh: 100, stateHigh: "dead_plant",
        tempLow: -5, stateLow: "frozen_plant", burn: 50, burnTime: 30,
        tick: function (pixel) {
            if (tryMove(pixel, pixel.x, pixel.y + 1)) {
                pixel.age = 0;
            } else if (comfortable(pixel)) {
                const soil = at(pixel.x, pixel.y + 1);
                if (soil && soils.indexOf(soil.element) !== -1) {
                    pixel.age++;
                    if (pixel.age >= 75 && isEmpty(pixel.x, pixel.y - 1)) {
                        changePixel(soil, "root", false);
                        changePixel(pixel, "lg_lemon_tree", false);
                    }
                } else {
                    pixel.age = 0;
                }
            }
            doDefaults(pixel);
        },
        desc: "Plant one on Dirt, Mud, Clay Soil, Grass or Mycelium. Leave about 10 pixels above and 5 on each side. Grows only at 3-45 C."
    });

    // A finite growth plan: new branch pixels never generate more trees.
    // Store progress on the base pixel, so normal Sandboxels saves preserve it.
    function treePlan(height) {
        const plan = [];
        for (let h = 1; h <= height; h++) plan.push([0, -h, "lg_lemon_branch"]);
        for (let dx = -3; dx <= 3; dx++) {
            if (dx !== 0) plan.push([dx, -height + 1, "lg_lemon_branch"]);
        }
        for (let dy = -3; dy <= 2; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                if ((dx * dx) / 20 + (dy * dy) / 10 <= 1) {
                    plan.push([dx, -height + dy - 1, "lg_lemon_leaves"]);
                }
            }
        }
        return plan;
    }
    const wood = {
        color: ["#8e6038", "#a77643", "#765031"],
        behavior: behaviors.WALL, state: "solid", density: 700,
        hardness: 0.2, burn: 10, burnTime: 250,
        burnInto: ["charcoal", "ash"], tempHigh: 400,
        stateHigh: "charcoal", breakInto: "sawdust"
    };
    register("lemon_branch", "lemon branch", Object.assign({}, wood, {
        desc: "Lemon wood. Supports the tree canopy; compatible with fire and Smash."
    }));
    register("lemon_tree", "lemon tree", Object.assign({}, wood, {
        properties: {growth: 0, age: 0, treeHeight: 0},
        tick: function (pixel) {
            if (!comfortable(pixel)) return;
            pixel.age++;
            if (!pixel.treeHeight) pixel.treeHeight = 5 + Math.floor(Math.random() * 3);
            if (pixel.age % 4 !== 0) return;
            const plan = treePlan(pixel.treeHeight);
            if (pixel.growth >= plan.length) return;
            const node = plan[pixel.growth++];
            const x = pixel.x + node[0], y = pixel.y + node[1];
            // Never replace walls, other plants, or the player's constructions.
            if (isEmpty(x, y)) createPixel(node[2], x, y);
        },
        desc: "Draw a single pixel for a ready-to-grow lemon tree. Builds a finite trunk and canopy; leaves repeatedly grow lemons."
    }));
    register("lemon_leaves", "lemon leaves", {
        color: ["#3b7d32", "#4d963d", "#326c29"],
        behavior: behaviors.WALL, state: "solid", density: 400,
        properties: {age: 0, watered: 0, fruitCooldown: 0},
        tempHigh: 100, stateHigh: "dead_plant",
        tempLow: -5, stateLow: "frozen_plant",
        burn: 40, burnTime: 70, breakInto: "dead_plant",
        reactions: {water: {elem2: null, chance: 0.02, attr1: {watered: 600}}},
        tick: function (pixel) {
            if (!comfortable(pixel)) return;
            pixel.age++;
            if (pixel.watered > 0) pixel.watered--;
            if (pixel.fruitCooldown > 0) { pixel.fruitCooldown--; return; }
            if (pixel.age > 100 && isEmpty(pixel.x, pixel.y + 1) &&
                Math.random() < (pixel.watered > 0 ? 0.012 : 0.004)) {
                createPixel("lg_unripe_lemon", pixel.x, pixel.y + 1);
                pixel.fruitCooldown = 300;
            }
        },
        desc: "Grows hanging lemons below it. Water boosts fruit production. Ripe fruit falls and the leaves regrow more."
    });

    elements.lg_lemon_juice = drink("lemon juice", ["#efda4d", "#e8d254"], {
        density: 1060, tempLow: -8, stateLow: "lg_frozen_juice",
        tempHigh: 110, stateHigh: ["steam", "steam", "lg_lemon_zest"],
        desc: "Sour juice from smashed lemons. Add Water then Sugar, or Sugar then Water. Sugar Water makes lemonade directly."
    });
    elements.lg_lemon_water = drink("lemon water", ["#e7e58e", "#f0eda0"], {
        density: 1010, stateLow: "lg_frozen_juice",
        desc: "Diluted lemon juice: still needs Sugar or Honey to become lemonade."
    });
    elements.lg_sweet_lemon_juice = drink("sweet lemon juice", ["#e5c93f", "#eed547"], {
        density: 1100, stateLow: "lg_frozen_juice",
        desc: "Sweetened lemon concentrate: add Water to make lemonade."
    });
    elements.lg_lemonade = drink("lemonade", ["#f5ee9b", "#fff3af", "#efe38b"], {
        desc: "Made from Lemon Juice + Water + Sugar. Try Juice for fruit lemonade, Seltzer for fizz, or Cool below -5 C."
    });
    elements.lg_fruit_lemonade = drink("fruit lemonade", ["#efa0b2", "#f7b0bb"], {
        desc: "Lemonade mixed with fruit Juice. Also accepts berry juices from supported food mods."
    });
    elements.lg_fizzy_lemonade = drink("fizzy lemonade", ["#fbefb0", "#fff6c6"], {
        tick: function (pixel) {
            if (pixel.temp > 0 && Math.random() < 0.015 && isEmpty(pixel.x, pixel.y - 1)) {
                createPixel("carbon_dioxide", pixel.x, pixel.y - 1);
            }
        },
        desc: "Lemonade + Seltzer or Carbon Dioxide. Releases bubbles."
    });
    for (const ingredient of waterTypes) {
        addReaction(elements.lg_lemon_juice, ingredient, "lg_lemon_water");
        addReaction(elements.lg_sweet_lemon_juice, ingredient, "lg_lemonade");
    }
    for (const ingredient of ["sugar", "honey"]) {
        addReaction(elements.lg_lemon_juice, ingredient, "lg_sweet_lemon_juice");
        addReaction(elements.lg_lemon_water, ingredient, "lg_lemonade");
    }
    addReaction(elements.lg_lemon_juice, "sugar_water", "lg_lemonade");
    addReaction(elements.lg_lemon_water, "sugar_water", "lg_lemonade");
    addReaction(elements.lg_sweet_lemon_juice, "sugar_water", "lg_lemonade");
    for (const id of ["lg_lemonade", "lg_fruit_lemonade"]) {
        addReaction(elements[id], "seltzer", "lg_fizzy_lemonade");
        addReaction(elements[id], "carbon_dioxide", "lg_fizzy_lemonade", {chance: 0.05});
    }
    addReaction(elements.lg_lemonade, "juice", "lg_fruit_lemonade");

    register("lemonade_ice", "lemonade ice", {
        color: ["#fffbd5", "#eaeeb7"], behavior: behaviors.WALL,
        state: "solid", density: 940, isFood: true, temp: -10,
        tempHigh: 0, stateHigh: "lg_lemonade",
        breakInto: "lg_lemonade_slush", hardness: 0.1,
        onStateHigh: thaw,
        desc: "Frozen lemonade. Heat above 0 C to melt; Smash into lemonade slush. Remembers its lemonade flavor."
    });
    register("lemonade_slush", "lemonade slush", {
        color: ["#faf4c5", "#eee8aa"], behavior: behaviors.POWDER,
        state: "solid", density: 950, isFood: true, temp: -5,
        tempHigh: 0, stateHigh: "lg_lemonade", onStateHigh: thaw,
        desc: "Crushed lemonade ice. Falls like snow and melts back into lemonade above 0 C."
    });
    register("frozen_juice", "frozen lemon juice", {
        color: ["#eee89a", "#faf3b9"], behavior: behaviors.WALL,
        state: "solid", density: 950, isFood: true, temp: -12,
        tempHigh: 0, stateHigh: "lg_lemon_juice", hardness: 0.1, onStateHigh: thaw,
        desc: "Frozen lemon concentrate. Remembers whether it was sour, diluted or sweetened."
    });
    register("lemon_zest", "lemon zest", {
        color: ["#f8ce2b", "#eabb20"], behavior: behaviors.POWDER,
        state: "solid", density: 650, isFood: true,
        burn: 30, burnTime: 40, tempHigh: 180, stateHigh: "ash",
        desc: "Lemon solids left after boiling juice. Adds lemon flavor to Batter or Dough."
    });
    register("candied_lemon", "candied lemon", {
        color: ["#e9b52b", "#f3c740"], behavior: behaviors.POWDER,
        state: "solid", density: 1200, isFood: true,
        breakInto: "lg_sweet_lemon_juice", hardness: 0.15,
        tempHigh: 180, stateHigh: "caramel",
        desc: "Lemon + Sugar above 65 C. Smash into sweet concentrate, then add Water."
    });
    for (const id of ["batter", "dough"]) {
        addReaction(elements.lg_lemon_zest, id, id, {
            elem1: null, elem2: id, color2: "#e8d586"
        });
    }

    register("lemon_juicer", "lemon juicer", {
        color: ["#babec4", "#8b949e", "#ffe059"],
        behavior: behaviors.WALL, state: "solid", density: 7800,
        hardness: 0.8, conduct: 0.7, tempHigh: 1455, stateHigh: "molten_steel",
        tick: function (pixel) {
            for (const offset of nearby) {
                const fruit = at(pixel.x + offset[0], pixel.y + offset[1]);
                if (fruit && fruitTypes.indexOf(fruit.element) !== -1) {
                    changePixel(fruit, "lg_lemon_juice", false);
                }
            }
        },
        desc: "A stationary machine: turns adjacent lemons into juice. Put it beside the falling fruit, with a container below. Also accepts lemons from other mods."
    });
    register("lemon_harvest", "lemon harvest", {
        color: ["#88b956", "#ffd83e"], canPlace: false,
        tool: function (pixel) {
            if (pixel.element === "lg_unripe_lemon") changePixel(pixel, "lg_lemon", false);
        },
        desc: "Brush over hanging unripe lemons to drop whole lemons without crushing them."
    });
    register("lemon_pit", "lemon pit", {
        color: ["#dfd1a0", "#ffe455"], canPlace: false,
        tool: function (pixel) {
            if (pixel.element === "lg_lemon") changePixel(pixel, "lg_lemon_seed", false);
        },
        desc: "Turn a whole lemon into one seed to plant another tree. Sacrifices that lemon."
    });

    function thaw(pixel) {
        const source = pixel.lgThaw;
        delete pixel.lgThaw;
        if (source && elements[source] && elements[source].state === "liquid") {
            changePixel(pixel, source, false);
        }
    }
    for (const id of ["lg_lemon_juice", "lg_lemon_water", "lg_sweet_lemon_juice", "lg_lemonade", "lg_fruit_lemonade", "lg_fizzy_lemonade"]) {
        elements[id].onStateLow = function (pixel) { pixel.lgThaw = id; };
    }

    runAfterLoad(function () {
        // Optional ingredients are detected after all mods load. No foreign
        // elements, tools, functions, or existing reactions are replaced.
        for (const id of ["strawberry_juice", "raspberry_juice", "cherry_juice", "grape_juice", "blueberry_juice"]) {
            if (elements[id]) addReaction(elements.lg_lemonade, id, "lg_fruit_lemonade");
        }
        for (const eater of ["head", "body"]) {
            if (!elements[eater]) continue;
            if (!elements[eater].reactions) elements[eater].reactions = {};
            for (const id of Object.keys(elements)) {
                if (id.startsWith("lg_") && elements[id].isFood && !elements[eater].reactions[id]) {
                    elements[eater].reactions[id] = {elem2: null, chance: 0.1};
                }
            }
        }
    });
}());
