const WebSocket = require('ws');
const port = 8080;
const wss = new WebSocket.Server({ port })
const clients = new Map();
const connections = new Map(); // Monitors connections coming from the same IP
const connectionsThreshold = 5; // Number of maximum connections allowed from the same IP
const recentMatches = new Map();
const clock = 1000 // 1 second
const usersOnlineClock = 1000; // 1 second
const maleGroup = {};
const femaleGroup = {};
const otherGroup = {};

wss.on('connection', function connection(ws, req) {
    let client = {
        id: uuidv4(),
        sessionId: null,
        ws: ws,
        filtered: false,
        paired: false,
        age: null,
        gender: null,
        country: null,
        proxyCountry: null,
        clientGroup: null,
        partnerGroup: null,
        timeouts: []
    }
    clients.set(client.id, client.ws);
    let wsClient = clients.get(client.id);

    // Check if client has performed too many connections.
    checkConnections();

    // Send number of users currently online
    clientsOnline(wsClient);

    // On Message (Listens in lobby)
    wsClient.on('message', function applyFilters(data) {        
        client = filterUser(client, data); // Updates client with the provided filters.
    })

    // On Close (Listens in lobby)
    wsClient.on('close', function closeSocket() {
        if (wsClient.readyState === WebSocket.OPEN) {
            wsClient.close();
        }
        clients.delete(client.id);
        removeClientFromGroup(client, getGroup(client.country, client.clientGroup));
        removeClientFromGroup(client, getGroup(client.proxyCountry, client.clientGroup));
        reclock(client);
        deleteConnection(req.socket.remoteAddress);

        return false;
    })

    awaitFilters();

    function awaitFilters() {
        checkOverflow(client);

        if (!client.filtered) {
            client.timeouts.push(setTimeout(awaitFilters, clock));
        } else {
            comms();
        }
    }

    function comms() {
        wsClient = clients.get(client.id);
        let clientDisconnected = false;
        let partnerDisconnected = false;
        if (!recentMatches.has(client.sessionId)) {
            recentMatches.set(client.sessionId, new Map());
        }

        findPartner();

        /**
         * Keep waiting for a partner to appear in the partnerGroup.
         * Triggers every second, as described by the global 'clock' variable
         * used in the 'keepSearching()' method.
         */
        function findPartner() {     
            groupify(client);  
            checkOverflow(client); // Keep track of client.timeouts
            if (getGroup(client.country, client.partnerGroup) === undefined) { // Case group does not exist
                console.log('1');
                keepSearching();
            } else {             
                if (getGroup(client.country, client.partnerGroup).length === 0) { // No users online
                    console.log('2');                        
                    keepSearching();
                } else {
                    // Find partner closest in age and remove him from the group                     
                    let partner = findClosestClient(getGroup(client.country, client.partnerGroup), client, 'age');                  
                    removeClientFromGroup(partner, getGroup(client.country, client.partnerGroup));
                    removeClientFromGroup(partner, getGroup(client.proxyCountry, client.partnerGroup));
                    checkOverflow(partner);        
                    if (partner.id === client.id) { // Case client is assigned an id already in use (almost impossible) or connects with himself.                      
                        console.log('3');
                        getGroup(client.country, client.partnerGroup).push(partner);                        
                        keepSearching();
                    } else {   
                        if(client.paired || partner.paired) {
                            console.log('4')
                            keepSearching();
                        } else {                     
                            reclock(client); // Clear all timeouts on user.
                            reclock(partner);
                            connect(partner); // Establish event listeners for client and partner in chat room.
                        }                 
                    }
                }
            }
        }

        /**
         * Invokes 'findPartner()' every second, storing each timeout on the client.
         * Re-examines the group names (Is included inside 'keepSearching()' method, because 
         * is needed on each if statement of 'findPartner' or else doesn't work, not sure why is that).
         */
        function keepSearching() {
            client.timeouts.push(setTimeout(findPartner, clock));
        }

        /**
         * Establish connection to partner with new listeners pertaining to the chat room.
         */
        function connect(partner) {
            client.paired = true
            partner.paired = true
            let wsPartner = clients.get(partner.id);
            if (wsPartner === undefined) {
                keepSearching();
                return;
            }            

            removeClientFromGroup(client, getGroup(client.country, client.clientGroup)); // Start by removing client from his groups
            removeClientFromGroup(client, getGroup(client.proxyCountry, client.clientGroup));

            // Remove lobby listeners
            wsClient.removeAllListeners();
            wsPartner.removeAllListeners();

            console.log('Pair: ' + client.id + ", " + partner.id);
            console.log('Session pair: ' + client.sessionId + ", " + partner.sessionId);

            /**
             * Signal client and partner that their connection is established, by sharing their info.
             */
            const clientInfo = { gender: client.gender, age: client.age, country: client.country };
            const partnerInfo = { gender: partner.gender, age: partner.age, country: partner.country };
            if (wsClient.readyState === WebSocket.OPEN && wsPartner.readyState === WebSocket.OPEN &&
                clients.has(partner.id) && clients.has(client.id)) {                
                wsClient.send(JSON.stringify(partnerInfo));
                wsPartner.send(JSON.stringify(clientInfo));
            }
            // On Message
            wsClient.on('message', function clientIncoming(data) {    
                let info = JSON.parse(data);
                if (info.hasOwnProperty('disconnected')) {
                    skip('client');
                    return;
                }
                if (wsClient.readyState === WebSocket.OPEN && clients.has(partner.id)) {
                    if (typeof (info) === 'object') {
                        wsPartner.send(JSON.stringify(info));
                        console.log('client to parnter: ' + JSON.stringify(info.message));
                    } else {
                        wsPartner.send(info);
                        console.log('client to parnter: ' + info);
                    }


                }
            })

            wsPartner.on('message', function partnerIncoming(data) {
                let info = JSON.parse(data);
                if (info.hasOwnProperty('disconnected')) {
                    skip('partner');
                    return;
                }
                if (wsPartner.readyState === WebSocket.OPEN && clients.has(client.id)) {
                    if (typeof (info) === 'object') {
                        wsClient.send(JSON.stringify(info));
                        console.log('partner to client: ' + JSON.stringify(info.message));
                    } else {
                        wsClient.send(info);
                        console.log('partner to client: ' + info);
                    }

                }
            })

            // On Close
            wsClient.on('close', () => {
                closeSocket('client');
            })

            wsPartner.on('close', () => {
                closeSocket('partner');
            })


            // Prepare for socket closure
            function closeSocket(user) {
                skip(user);
                deleteConnection(req.socket.remoteAddress);
                switch (user) {
                    case 'client':
                        console.log('Closing client: ' + client.id);                        
                        if (wsClient.readyState === WebSocket.OPEN) {
                            wsClient.close();
                        }
                        clients.delete(client.id);
                        recentMatches.delete(client.sessionId);
                        removeClientFromGroup(client, getGroup(client.country, client.clientGroup));
                        removeClientFromGroup(client, getGroup(client.proxyCountry, client.clientGroup));                                                
                        break;
                    case 'partner':
                        console.log('Closing partner: ' + partner.id);
                        if (wsPartner.readyState === WebSocket.OPEN) {
                            wsPartner.close();
                        }
                        clients.delete(partner.id);
                        recentMatches.delete(partner.sessionId);
                        removeClientFromGroup(partner, getGroup(client.country, client.partnerGroup));
                        removeClientFromGroup(partner, getGroup(client.proxyCountry, client.partnerGroup));
                        break;
                }
                console.log(maleGroup['Greece'].length)
            }

            // Skips partner
            function skip(user) {
                switch (user) {
                    case 'client':
                        if (wsPartner.readyState === WebSocket.OPEN && clients.has(partner.id) && !partnerDisconnected) {
                            wsPartner.send(JSON.stringify({ disconnected: true }));
                            clientDisconnected = true;
                            client.paired = false;
                        }
                        break;
                    case 'partner':
                        if (wsClient.readyState === WebSocket.OPEN && clients.has(client.id) && !clientDisconnected) {
                            wsClient.send(JSON.stringify({ disconnected: true }));
                            partnerDisconnected = true;
                            partner.paired = false;
                        }
                        break;
                }
            }

        }
    }

    // Check number of connections. Prevent connection if they exceed threshold.
    function checkConnections() {
        if (connections.has(req.socket.remoteAddress)) {
            connections.get(req.socket.remoteAddress).push(client.id);
        } else {
            connections.set(req.socket.remoteAddress, [client.id]);
        }
        if (connections.get(req.socket.remoteAddress).length > connectionsThreshold) {
            wsClient.send(JSON.stringify({ connectionsExceeded: true }));
            wsClient.close();
        }
    }

    // Deletes a client's stored connection
    function deleteConnection(connection) {
        if (!connections.has(connection)) {
            return;
        }
        connections.get(connection).pop();
        if (connections.get(connection).length === 0) {
            connections.delete(connection);
        }
    }

    // Send number of users currently online
    function clientsOnline(socket) {
        let clientsNumber = clients.size;
        if (clientsNumber > 100 && clientsNumber <= 1000) {
            clientsNumber = Math.floor(clientsNumber / 100) + '00+';
        }
        if (clientsNumber > 1000 && clientsNumber <= 10000) {
            clientsNumber = Math.floor(clientsNumber / 1000) + '.000+';
        }
        if (clientsNumber > 10000 && clientsNumber <= 100000) {
            clientsNumber = Math.floor(clientsNumber / 1000) + '.000+';
        }
        if (clientsNumber > 100000 && clientsNumber <= 1000000) {
            clientsNumber = Math.floor(clientsNumber / 1000) + '.000+';
        }
        socket.send(JSON.stringify({ online: clientsNumber }));
        setTimeout(clientsOnline, usersOnlineClock, wsClient);
    }

})


/**
 * Helping functions
 */

// Generates a random id.
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Add peek function to native Array
Array.prototype.peek = function () {
    if (this.length === 0) {
        return undefined;
    }
    return this[this.length - 1];
};

/**
 * Group users based on country and gender.
 */
function groupify(user) {
    let country = user.country

    if( !(country in maleGroup) ) maleGroup[country] = [] // Initialize group  
    if( !(country in femaleGroup) ) femaleGroup[country] = [] // Initialize group
    if( !(country in otherGroup) ) otherGroup[country] = [] // Initialize group

    // Check country availability to determine if proxy country should be prefered
    if(maleGroup[country].length + femaleGroup[country].length + otherGroup[country].length === 1) {
        var keys = Object.keys(maleGroup);
        delete keys[country]     
        user.proxyCountry = keys[keys.length * Math.random() << 0];
        country = user.proxyCountry
    }   

    switch(user.gender) {
        case 'Male':               
            user.clientGroup = 'maleGroup'            
            user.partnerGroup = calcPartnerGroup(user);
            insertSorted(maleGroup[country], user, 'age');  
            break;               
        case 'Female':            
            user.clientGroup = 'femaleGroup'
            user.partnerGroup = calcPartnerGroup(user);
            insertSorted(femaleGroup[country], user, 'age');
            break;
        case 'Other':
            user.clientGroup = 'otherGroup'
            user.partnerGroup = calcPartnerGroup(user);
            insertSorted(otherGroup[country], user, 'age');     
            break;       
        default:            
            return null
      }      

}

function calcPartnerGroup(user) {    
    switch(user.clientGroup) {
        case 'maleGroup':            
            if(femaleGroup[user.country].length > 0) return 'femaleGroup'      
            return Math.random() > 0.5 ? 'maleGroup' : 'otherGroup'
        case 'femaleGroup':            
            if(maleGroup[user.country].length > 0) return 'maleGroup'      
            return Math.random() > 0.5 ? 'femaleGroup' : 'otherGroup'
        case 'otherGroup':            
            if(otherGroup[user.country].length > 0) return 'otherGroup'      
            return Math.random() > 0.5 ? 'maleGroup' : 'femaleGroup'
        default:
            return null
    }
}

/**
 * While client in lobby (client.filtered = false), returns client as is.
 * When filters are applied, parses them and returns filtered client.
 */
function filterUser(client, data) {
    if (!client.filtered) {        
        let info = JSON.parse(data);

        client.filtered = true;
        client.sessionId = info.sessionId;
        client.gender = info.myGender;
        client.age = info.myAge;
        client.country = info.country;
        
        return client;
    }
    
    return client;
}

/**
 * Clears all timeouts applied to the client while waiting in lobby or searching a partner.
 */
function reclock(user) {
    user.timeouts.forEach((time) => {
        clearTimeout(time);
    })
}

/**
 * Evade overflow from timeouts by emptying the array every 10 secs.
 * Evade overflow of recentMatches (Map) by deleting the key every 20 matches.
 */
function checkOverflow(user) {
    if (user.timeouts.length >= 10) {
        reclock(user);
        user.timeouts = [];
    }
    if (recentMatches.has(user.sessionId)) {
        if (recentMatches.get(user.sessionId).size > 20) {
            recentMatches.delete(user.sessionId);
        }
    }
}

/**
 * Insert object to array, but sorted based on a key
 */
function insertSorted(array, obj, key) {
    // In case obj already exists
    if(array.includes(obj)) return array;

    // Find the correct index to insert the object
    let index = array.findIndex(item => item[key] > obj[key]);
    
    // If no such index is found, push the object at the end
    if (index === -1) {
        array.push(obj);
    } else {
        array.splice(index, 0, obj);
    }
    
    return array;
}

function findClosestClient(array, client, key) {
    if (array.length === 0) return null;

    // Avoid users of same group connecting with themselves, when there are only clients who share their age
    if(client.clientGroup === client.partnerGroup && array.length > 1) {
        removeClientFromGroup(client, array);
    }

    return array.reduce((closest, current) => {
        return Math.abs(current[key] - client.age) < Math.abs(closest[key] - client.age) ? current : closest;
    });
}

function getGroup(country, group) {
    switch(group) {
        case 'maleGroup':
            return maleGroup[country];            
        case 'femaleGroup': 
            return femaleGroup[country];
        case 'otherGroup':
            return otherGroup[country];
        default:
            return null
    }
}

function removeClientFromGroup(client, group) {
    if(group != null && group.includes(client))    
        group.splice(group.indexOf(client), 1);   
}

console.log('WebSocket Server is listening on port ' + port + '!')