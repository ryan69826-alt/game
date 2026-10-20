/* Location geometry lives outside saves. Each location owns its grid dimensions. */
setup.worldMaps = (() => {
    const buildings = [
        {name:'Apartment 1',x:28,y:14,width:32,height:10,door:{x:32,y:23},facing:'south'},
        {name:'Apartment 2',x:64,y:23,width:10,height:32,door:{x:64,y:27},facing:'west'},
        {name:'Apartment 3',x:28,y:46,width:32,height:10,door:{x:55,y:46},facing:'north'},
        {name:'Apartment 4',x:14,y:23,width:10,height:32,door:{x:23,y:50},facing:'east'}
    ];
    const housingOffice={name:'Housing Office',label:'OFFICE',x:65,y:56,width:8,height:8,door:{x:69,y:56},facing:'north'};
    const interiorMaps=buildings.map((building,index)=>setup.interiorMaps.apartment(building,index+1));
    const officeMap=setup.interiorMaps.office(housingOffice);
    const inRect = (x, y, left, top, width, height) => x >= left && x < left + width && y >= top && y < top + height;
    const trees = [[29,35],[39,35],[29,39],[55,39]];
    const roads = {horizontal: {y: 64, height: 5}, vertical: {x: 4, width: 5}};
    const park = {x:27,y:27,width:34,height:16};
    const parking = {x: 77, y: 48, width: 12, height: 15,
        median: {x: 80, y: 55, width: 6, height: 2}};
    const frontParking={x:11,y:57,width:14,height:6};
    const parkingLots=[frontParking,parking];
    const parkingDriveways=[{x:11,y:63,width:4,height:1},{x:75,y:59,width:2,height:5}];
    const parkingBays = [
        ...[77, 79, 81, 83, 85, 87].flatMap(x => [48, 61].map(y => ({x, y, width: 2, height: 2, facing: y === 48 ? 'north' : 'south'}))),
        ...[80, 82, 84].flatMap(x => [53, 57].map(y => ({x, y, width: 2, height: 2, facing: y === 53 ? 'south' : 'north'}))),
        ...[11,13,15,17,19,21,23].map(x=>({x,y:57,width:2,height:2,facing:'north'})),
        ...[15,17,19,21,23].map(x=>({x,y:61,width:2,height:2,facing:'south'}))
    ];
    const cars = [[11, 28], [15, 28], [21, 28], [13, 41], [19, 41], [21, 41], [14, 33], [18, 37]]
        .map(([oldX, oldY], index) => {const x=oldX+66,y=oldY+20;return {x, y, width: 2, height: 2, color: ['#718da0', '#a69782', '#697c75'][index % 3],
            facing: parkingBays.find(bay => bay.x === x && bay.y === y).facing};});
    // Append new cars so existing vehicle IDs, locks and stored contents stay stable.
    for(const [x,y]of [[11,57],[19,57],[15,61],[23,61]])cars.push({x,y,width:2,height:2,color:'#718da0',facing:y===57?'north':'south'});
    const interactables = [
        ...buildings.map((building, index) => ({id: `apartment-door-${index + 1}`, kind: 'door',
            name: `${building.name} door`, ...building.door, width: 1, height: 1,lockId:`building-${index+1}`,lockLevel:1,
            destination:{mapId:interiorMaps[index].id,...interiorMaps[index].spawn},
            description: 'A single-floor building with four apartments. Its entrance faces the central park.'})),
        {id:'housing-office-door',kind:'door',name:'Housing office door',...housingOffice.door,width:1,height:1,lockId:'housing-office',lockLevel:1,
            destination:{mapId:officeMap.id,...officeMap.spawn},description:'The housing office handles rentals for all four apartment buildings.'},
        ...cars.map((car, index) => ({id: `parked-car-${index + 1}`, kind: 'car',
            name: `Parked car ${index + 1}`,lockId:`vehicle:apartments:parked-car-${index+1}`,lockLevel:3,trunkLockLevel:2, x: car.x, y: car.y, width: car.width, height: car.height, facing: car.facing,
            description: `Parked nose-in, facing ${car.facing}. The trunk faces the driving aisle.`}))
    ];
    const inside = (x, y, rect) => inRect(x, y, rect.x, rect.y, rect.width, rect.height);
    const tile = (kind, label, walkable = true) => ({kind, label, walkable});
    function apartmentTile(x, y) {
        if (!Number.isInteger(x) || !Number.isInteger(y) || !inRect(x, y, 0, 0, 90, 74)) return tile('boundary', 'Edge of the area', false);
        for (const building of [...buildings,housingOffice]) {
            if (x === building.door.x && y === building.door.y) return tile('entrance', `${building.name} entrance`);
            if (inRect(x, y, building.x, building.y, building.width, building.height)) return tile('building', building.name, false);
        }
        if (trees.some(([tx, ty]) => tx === x && ty === y)) return tile('tree', 'Park tree', false);
        if (cars.some(car => inside(x, y, car))) return tile('car', 'Parked car', false);
        if (inside(x, y, parking.median)) return tile('median', 'Planted parking median', false);
        if (y >= roads.horizontal.y && y < roads.horizontal.y + roads.horizontal.height ||
            x >= roads.vertical.x && x < roads.vertical.x + roads.vertical.width && y <= roads.horizontal.y) return tile('road', 'Road');
        if (parkingLots.some(lot=>inside(x,y,lot)) || parkingDriveways.some(driveway=>inside(x,y,driveway))) return tile('parking', 'Apartment parking lot');
        if ((x === 3 || x === 9) && y < 64 || y === 63 || y === 69) return tile('pavement', 'Pavement');
        const parkRing=(x>=25&&x<=26||x>=61&&x<=62)&&y>=25&&y<=44 || (y>=25&&y<=26||y>=43&&y<=44)&&x>=25&&x<=62;
        const entrancePath=x===32&&y===24 || x===55&&y===45 || y===27&&x===63 || y===50&&x===24;
        const accessPath=(x>=25&&x<=26||x>=61&&x<=62)&&y>=44&&y<=63;
        const officePath=y===55&&x>=61&&x<=69;
        if (parkRing || entrancePath || accessPath || officePath || y===56&&x>=11&&x<=26) return tile('path', 'Courtyard sidewalk');
        if (inside(x, y, park)) return tile('park', 'Central park');
        return tile('ground', 'Apartment grounds');
    }
    return {apartments: {id: 'apartments', name: 'Apartments', width: 90, height: 74,
        subtitle:'A small corner of the city.',description:'Four single-floor apartment buildings face a patchy central lawn with mature trees, scruffy bushes and two worn benches. Each contains four apartments in a single row. Paths connect their entrances, with a compact parking lot beside the southwest road and overflow parking to the east. The housing office stands to the right of Apartment 3.',
        labels:[{text:'PARKING',x:18,y:60}],
        spawn: {x: 30, y: 33}, trees, buildings, housingOffice, roads, park, parking, parkingLots, parkingDriveways, parkingBays, cars, interactables, tileAt: apartmentTile},
        ...Object.fromEntries([...interiorMaps,officeMap].map(map=>[map.id,map]))};
})();

setup.courtyardPark.decorate(setup.worldMaps.apartments);

setup.storageDistrict();

setup.neighborhoodDistrict();

setup.transitDistrict();

setup.nightlifeDistrict();

setup.executiveDistrict();

setup.interiorSizing.apply();
