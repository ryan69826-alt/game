/* Location geometry lives outside saves. Each location owns its grid dimensions. */
setup.worldMaps = (() => {
    const buildings = [
        {name: 'Apartment 1', x: 25, y: 8, width: 11, height: 8, door: {x: 30, y: 15}, facing: 'south'},
        {name: 'Apartment 2', x: 37, y: 19, width: 8, height: 9, door: {x: 37, y: 23}, facing: 'west'},
        {name: 'Apartment 3', x: 25, y: 31, width: 11, height: 8, door: {x: 30, y: 31}, facing: 'north'},
        {name: 'Apartment 4', x: 16, y: 19, width: 8, height: 9, door: {x: 23, y: 23}, facing: 'east'}
    ];
    const inRect = (x, y, left, top, width, height) => x >= left && x < left + width && y >= top && y < top + height;
    const trees = [[27, 20], [33, 20], [27, 26], [33, 26]];
    const cars = [[12, 34], [15, 34], [18, 34], [12, 38], [15, 38]];
    const tile = (kind, label, walkable = true) => ({kind, label, walkable});
    function apartmentTile(x, y) {
        if (!Number.isInteger(x) || !Number.isInteger(y) || !inRect(x, y, 0, 0, 50, 50)) return tile('boundary', 'Edge of the area', false);
        for (const building of buildings) {
            if (x === building.door.x && y === building.door.y) return tile('entrance', `${building.name} entrance`);
            if (inRect(x, y, building.x, building.y, building.width, building.height)) return tile('building', building.name, false);
        }
        if (trees.some(([tx, ty]) => tx === x && ty === y)) return tile('tree', 'Park tree', false);
        if (cars.some(([cx, cy]) => cx === x && cy === y)) return tile('car', 'Parked car', false);
        if (y >= 45 && y <= 48 || x >= 5 && x <= 8 && y <= 45) return tile('road', 'Road');
        if (inRect(x, y, 11, 31, 9, 12) || inRect(x, y, 9, 39, 3, 3)) return tile('parking', 'Apartment parking lot');
        if (x === 4 || x === 9 || y === 44 || y === 49) return tile('pavement', 'Pavement');
        if (x === 30 && y >= 16 && y <= 30 || y === 23 && x >= 24 && x <= 36 ||
            x === 36 && y >= 28 && y <= 43 || y === 29 && x >= 24 && x <= 36 ||
            y === 42 && x >= 20 && x <= 36 || x === 24 && y >= 28 && y <= 42) return tile('path', 'Courtyard path');
        if (inRect(x, y, 26, 19, 9, 9)) return tile('park', 'Central park');
        return tile('ground', 'Apartment grounds');
    }
    return {apartments: {id: 'apartments', name: 'Apartments', width: 50, height: 50,
        spawn: {x: 30, y: 23}, buildings, tileAt: apartmentTile}};
})();
