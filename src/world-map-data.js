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
    const roads = {horizontal: {y: 44, height: 5}, vertical: {x: 4, width: 5}};
    const park = {x: 26, y: 19, width: 9, height: 9};
    const parking = {x: 11, y: 28, width: 12, height: 15,
        median: {x: 14, y: 35, width: 6, height: 2}};
    const parkingBays = [
        ...[11, 13, 15, 17, 19, 21].flatMap(x => [28, 41].map(y => ({x, y, width: 2, height: 2, facing: y === 28 ? 'north' : 'south'}))),
        ...[14, 16, 18].flatMap(x => [33, 37].map(y => ({x, y, width: 2, height: 2, facing: y === 33 ? 'south' : 'north'})))
    ];
    const cars = [[11, 28], [15, 28], [21, 28], [13, 41], [19, 41], [21, 41], [14, 33], [18, 37]]
        .map(([x, y], index) => ({x, y, width: 2, height: 2, color: ['#718da0', '#a69782', '#697c75'][index % 3],
            facing: parkingBays.find(bay => bay.x === x && bay.y === y).facing}));
    const interactables = [
        ...buildings.map((building, index) => ({id: `apartment-door-${index + 1}`, kind: 'door',
            name: `${building.name} door`, ...building.door, width: 1, height: 1,
            description: 'An apartment entrance facing the central park.'})),
        ...cars.map((car, index) => ({id: `parked-car-${index + 1}`, kind: 'car',
            name: `Parked car ${index + 1}`, x: car.x, y: car.y, width: car.width, height: car.height, facing: car.facing,
            description: `Parked nose-in, facing ${car.facing}. The trunk faces the driving aisle.`}))
    ];
    const inside = (x, y, rect) => inRect(x, y, rect.x, rect.y, rect.width, rect.height);
    const tile = (kind, label, walkable = true) => ({kind, label, walkable});
    function apartmentTile(x, y) {
        if (!Number.isInteger(x) || !Number.isInteger(y) || !inRect(x, y, 0, 0, 50, 50)) return tile('boundary', 'Edge of the area', false);
        for (const building of buildings) {
            if (x === building.door.x && y === building.door.y) return tile('entrance', `${building.name} entrance`);
            if (inRect(x, y, building.x, building.y, building.width, building.height)) return tile('building', building.name, false);
        }
        if (trees.some(([tx, ty]) => tx === x && ty === y)) return tile('tree', 'Park tree', false);
        if (cars.some(car => inside(x, y, car))) return tile('car', 'Parked car', false);
        if (inside(x, y, parking.median)) return tile('median', 'Planted parking median', false);
        if (y >= roads.horizontal.y && y < roads.horizontal.y + roads.horizontal.height ||
            x >= roads.vertical.x && x < roads.vertical.x + roads.vertical.width && y <= roads.horizontal.y) return tile('road', 'Road');
        if (inside(x, y, parking) || inRect(x, y, 9, 39, 2, 2)) return tile('parking', 'Apartment parking lot');
        if (x === 3 || x === 9 || y === 43 || y === 49) return tile('pavement', 'Pavement');
        const parkRing = (x === 25 || x === 35) && y >= 18 && y <= 28 ||
            (y === 18 || y === 28) && x >= 25 && x <= 35;
        const entrancePath = x === 30 && (y >= 16 && y <= 17 || y >= 29 && y <= 30) ||
            y === 23 && (x === 24 || x === 36);
        const accessPath = (x === 24 || x === 36) && y >= 28 && y <= 42 ||
            x === 23 && y >= 39 && y <= 42 || y === 42 && x >= 23 && x <= 36;
        if (parkRing || entrancePath || accessPath) return tile('path', 'Courtyard sidewalk');
        if (inside(x, y, park)) return tile('park', 'Central park');
        return tile('ground', 'Apartment grounds');
    }
    return {apartments: {id: 'apartments', name: 'Apartments', width: 50, height: 50,
        spawn: {x: 30, y: 23}, buildings, roads, park, parking, parkingBays, cars, interactables, tileAt: apartmentTile}};
})();
