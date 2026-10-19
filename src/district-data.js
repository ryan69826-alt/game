/* Spreadsheet coordinates describe district relationships, never local tile sizes.
   Rows increase northward. null reserves an unassigned cell without naming it. */
setup.districts = (() => {
    const rows = [
        ['Low Density Housing','Warehouse/Storage','Low End Apartments','Transit Area w/ Shops','Nightlife','Executive Offices','Beach Resorts','Beach'],
        ['Abandoned Marketplace','Abandoned City Housing','Marketplace','Corporate Office Area','Corporate Housing','High End Adult Entertainment','Fire Station','Fishing Pier'],
        ['Scrapyard','Low End Adult Entertainment','Gas Station Area','Entertainment Center','City Center','Central Transit Hub','Data Center','Rehabilitation Resort'],
        ['Prison','Power Station','Park','High Density Market','Super High Density Residential','Government Complex','University','Transit Area'],
        ['Scrapyard','Waste Processing','High Density Residential Housing','Very High Density Residential','Hospital','Police Headquarters','Biotech Facility',null],
        ['Industrial Zone','Transit Area','Highway','Highway','Highway','Highway/Security Gate','Airport','Military Base'],
        ['Industrial Zone','Industrial Zone','Highway','Slums',null,'Spaceport','Port','Research Outpost']
    ];
    return rows.flatMap((row,y)=>row.flatMap((name,x)=>name?[{
        id:x===2&&y===0?'apartments':`${String.fromCharCode(65+x).toLowerCase()}${y+1}`,
        coordinate:`${String.fromCharCode(65+x)}${y+1}`,column:x,row:y,
        name:x===2&&y===0?'Apartments':name
    }]:[]));
})();
