const WebSocket = require('ws');
const port = 8080;
const wss = new WebSocket.Server({ port })
const clients = new Map();
const connections = new Map(); // Monitors connections coming from the same IP
const connectionsThreshold = 5; // Number of maximum connections allowed from the same IP
const groups = new Map();
const recentMatches = new Map();
const clock = 1000 // 1 second
const matchesTimeout = 30000; // 30 seconds
const usersOnlineClock = 1000; // 1 second
const genders = ['Male', 'Female'];
const ageGroups = ['18-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-59', '60+'];
const countries = ['Greece', 'France', 'Germany', 'Italy', 'Spain', 'Turkey', 'United States'];

wss.on('connection', function connection(ws, req) {
    let client = {
        id: uuidv4(),
        sessionId: null,
        ws: ws,
        filtered: false,
        age: null,
        gender: null,
        country: null,
        partnerAge: null,
        partnerGender: null,
        partnerCountry: null,
        timeouts: []
    }
    clients.set(client.id, client.ws);
    let wsClient = clients.get(client.id);
    let clientGroups = groupify(client); // Group users based on country, gender and age. Returns group names.
    let partnerGroup = predictPartnerGroup(client);

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
        clientGroups.forEach((clientGroup) => {
            groups.get(clientGroup).splice(groups.get(clientGroup).indexOf(client), 1);
        });
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
        clientGroups = groupify(client);
        partnerGroup = predictPartnerGroup(client);
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
            checkOverflow(client); // Keep track of client.timeouts

            if (groups.get(partnerGroup) === undefined) { // Case group does not exist yet, until a user is assigned to the particular partnerGroup.
                console.log('1');
                keepSearching();
            } else {
                // Case client is also in partnerGroup, remove him to avoid be chosen as partner
                if (groups.get(partnerGroup).includes(client)) {
                    groups.get(partnerGroup).splice(groups.get(partnerGroup).indexOf(client), 1);
                }
                if (groups.get(partnerGroup).length === 0) {
                    console.log('2');
                    keepSearching();
                } else {
                    // Select random user and remove him from the group
                    let partner = groups.get(partnerGroup).splice(Math.floor(Math.random() * groups.get(partnerGroup).length), 1)[0];
                    checkOverflow(partner);
                    if (partner.id === client.id) { // Case client is assigned an id already in use (almost impossible).
                        console.log('3');
                        keepSearching(partner);
                    } else {
                        let timestamp = Date.now();
                        if (recentlyMatched(partner, timestamp)) {
                            console.log('4');
                            keepSearching(partner);
                        } else {
                            reclock(client);  // Clear all timeouts on user.
                            reclock(partner);
                            connect(partner); // Establish event listeners for client and partner in chat room.
                        }
                    }
                }
            }
        }

        /**
         * Returns true if was recently matched with this partner the last 'matchesTimeout' seconds.
         * DOES NOT WORK PROPERLY AND CAUSES SERVER CRASH UNDER LOAD. NEEDS FIXING.          
         */
        function recentlyMatched(partner, timestamp) {
            if (recentMatches.get(client.sessionId).get(partner.sessionId) === undefined &&
                recentMatches.get(partner.sessionId).get(client.sessionId) === undefined) {
                return false;
            }
            if (recentMatches.get(client.sessionId).get(partner.sessionId) === undefined) {
                return timestamp - recentMatches.get(partner.sessionId).get(client.sessionId) <= matchesTimeout;
            }
            if (recentMatches.get(partner.sessionId).get(client.sessionId) === undefined) {
                return timestamp - recentMatches.get(client.sessionId).get(partner.sessionId) <= matchesTimeout;
            }
        }

        /**
         * Invokes 'findPartner()' every second, storing each timeout on the client.
         * Re-examines the group names (Is included inside 'keepSearching()' method, because 
         * is needed on each if statement of 'findPartner' or else doesn't work, not sure why is that).
         */
        function keepSearching(partner) {
            clientGroups = groupify(client);
            partnerGroup = predictPartnerGroup(client);
            if (arguments.length !== 0) {
                let partnerGroups = groupify(partner);
                partnerGroup = partnerGroups.splice(Math.floor(Math.random() * partnerGroups.length), 1)[0];
            }
            client.timeouts.push(setTimeout(findPartner, clock));
        }

        /**
         * Establish connection to partner with new listeners pertaining to the chat room.
         */
        function connect(partner) {
            let wsPartner = clients.get(partner.id);
            if (wsPartner === undefined) {
                keepSearching(partner);
                return;
            }

            clientGroups.forEach((clientGroup) => {
                groups.get(clientGroup).splice(groups.get(clientGroup).indexOf(client), 1); // Start by removing client from his groups
            });

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

            // Store new matches as to avoid them and free older ones.
            function manageRecentMatches(timestamp) {
                if (recentMatches.get(client.sessionId) === undefined ||
                    recentMatches.get(partner.sessionId) == undefined) {
                    return;
                }

                recentMatches.get(client.sessionId).forEach((matchTimestamp, sessionId) => {
                    if (timestamp - matchTimestamp > matchesTimeout) {
                        recentMatches.get(client.sessionId).delete(sessionId);
                    }
                })
                recentMatches.get(partner.sessionId).forEach((matchTimestamp, sessionId) => {
                    if (timestamp - matchTimestamp > matchesTimeout) {
                        recentMatches.get(partner.sessionId).delete(sessionId);
                    }
                })

                if (!recentMatches.get(client.sessionId).has(partner.sessionId)) {
                    recentMatches.get(client.sessionId).set(partner.sessionId, timestamp);
                    console.log("Recent match: " + recentMatches.get(client.sessionId));
                }
                if (!recentMatches.get(partner.sessionId).has(client.sessionId)) {
                    recentMatches.get(partner.sessionId).set(client.sessionId, timestamp);
                    console.log("Recent match: " + recentMatches.get(partner.sessionId));
                }
            }

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
                        manageRecentMatches(Date.now());
                        recentMatches.delete(client.sessionId);
                        clientGroups.forEach((clientGroup) => {
                            groups.get(clientGroup).splice(groups.get(clientGroup).indexOf(client), 1);
                        });
                        break;
                    case 'partner':
                        console.log('Closing partner: ' + partner.id);
                        if (wsPartner.readyState === WebSocket.OPEN) {
                            wsPartner.close();
                        }
                        clients.delete(partner.id);
                        manageRecentMatches(Date.now());
                        recentMatches.delete(partner.sessionId);
                        groups.get(partnerGroup).splice(groups.get(partnerGroup).indexOf(partner), 1);
                        break;
                }
            }

            // Skips partner
            function skip(user) {
                switch (user) {
                    case 'client':
                        if (wsPartner.readyState === WebSocket.OPEN && clients.has(partner.id) && !partnerDisconnected) {
                            wsPartner.send(JSON.stringify({ disconnected: true }));
                            clientDisconnected = true;
                        }
                        break;
                    case 'partner':
                        if (wsClient.readyState === WebSocket.OPEN && clients.has(client.id) && !clientDisconnected) {
                            wsClient.send(JSON.stringify({ disconnected: true }));
                            partnerDisconnected = true;
                        }
                        break;
                }
                manageRecentMatches(Date.now());
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
 * Generates a group name based on country, gender and age. If group name already exists,
 * appends user at the particular group. Else, creates new group with new name and
 * instantiates with this user id.
 */
function groupify(user) {
    let ageGroup = ageToGroup(user.age);
    let groupNames = [];
    let trails = [];
    let groupName = user.country + '_' + user.gender + '_' + ageGroup + '_';
    trails.push(groupName);
    if (user.partnerCountry === 'Any') {
        countries.forEach((country) => {
            groupName = trails.peek() + country + '_';
            trails.push(groupName);
            if (user.partnerGender === 'Any') {
                genders.forEach((gender) => {
                    groupName = trails.peek() + gender + '_';
                    trails.push(groupName);
                    if (user.partnerAge === 'Any') {
                        ageGroups.forEach((group) => {
                            groupName = trails.peek() + group;
                            groupNames.push(groupName);
                        });
                        trails.pop();
                    } else {
                        groupName = trails.pop() + user.partnerAge;
                        groupNames.push(groupName);
                    }
                });
            } else {
                groupName = trails.peek() + user.partnerGender + '_';
                trails.push(groupName);
                if (user.partnerAge === 'Any') {
                    ageGroups.forEach((group) => {
                        groupName = trails.peek() + group;
                        groupNames.push(groupName);
                    });
                    trails.pop();
                } else {
                    groupName = trails.pop() + user.partnerAge;
                    groupNames.push(groupName);
                }
            }
            trails.pop();
        });
    } else {
        groupName = user.partnerCountry + '_' + user.gender + '_' + ageGroup + '_' + user.partnerCountry + '_';
        trails.push(groupName);
        if (user.partnerGender === 'Any') {
            genders.forEach((gender) => {
                groupName = trails.peek() + gender + '_';
                trails.push(groupName);
                if (user.partnerAge === 'Any') {
                    ageGroups.forEach((group) => {
                        groupName = trails.peek() + group;
                        groupNames.push(groupName);
                    });
                    trails.pop();
                } else {
                    groupName = trails.pop() + user.partnerAge;
                    groupNames.push(groupName);
                }
            });
        } else {
            groupName = trails.peek() + user.partnerGender + '_';
            trails.push(groupName);
            if (user.partnerAge === 'Any') {
                ageGroups.forEach((group) => {
                    groupName = trails.peek() + group;
                    groupNames.push(groupName);
                });
                trails.pop();
            } else {
                groupName = trails.pop() + user.partnerAge;
                groupNames.push(groupName);
            }
        }
    }

    groupNames.forEach((groupName) => {
        if (groups.has(groupName)) {
            if (!groups.get(groupName).includes(user)) {
                groups.get(groupName).push(user);
            }
        } else {
            groups.set(groupName, [user]);
        }
    });

    return groupNames;
}

/**
 * Predicts partner group based on client's filters.
 */
function predictPartnerGroup(user) {
    let groupNames = [];
    let trails = [];
    let validGroups = [];
    let groupName = '';
    trails.push(groupName);
    let userAge = ageToGroup(user.age);
    if (user.partnerCountry === 'Any') {
        countries.forEach((country) => {
            groupName = trails.peek() + country + '_';
            trails.push(groupName);
            if (user.partnerGender === 'Any') {
                genders.forEach((gender) => {
                    groupName = trails.peek() + gender + '_';
                    trails.push(groupName);
                    if (user.partnerAge === 'Any') {
                        ageGroups.forEach((group) => {
                            groupName = trails.peek() + group + '_' + user.country + '_' + user.gender + '_' + userAge;
                            groupNames.push(groupName);
                        });
                        trails.pop();
                    } else {
                        groupName = trails.pop() + user.partnerAge + '_' + user.country + '_' + user.gender + '_' + userAge;
                        groupNames.push(groupName);
                    }
                });
            } else {
                groupName = trails.peek() + user.partnerGender + '_';
                trails.push(groupName);
                if (user.partnerAge === 'Any') {
                    ageGroups.forEach((group) => {
                        groupName = trails.peek() + group + '_' + user.country + '_' + user.gender + '_' + userAge;
                        groupNames.push(groupName);
                    });
                    trails.pop();
                } else {
                    groupName = trails.pop() + user.partnerAge + '_' + user.country + '_' + user.gender + '_' + userAge;
                    groupNames.push(groupName);
                }
            }
            trails.pop();
        });
    } else {
        groupName = trails.peek() + user.partnerCountry + '_';
        trails.push(groupName);
        if (user.partnerGender === 'Any') {
            genders.forEach((gender) => {
                groupName = trails.peek() + gender + '_';
                trails.push(groupName);
                if (user.partnerAge === 'Any') {
                    ageGroups.forEach((group) => {
                        groupName = trails.peek() + group + '_' + user.partnerCountry + '_' + user.gender + '_' + userAge;
                        groupNames.push(groupName);
                    });
                    trails.pop();
                } else {
                    groupName = trails.pop() + user.partnerAge + '_' + user.partnerCountry + '_' + user.gender + '_' + userAge;
                    groupNames.push(groupName);
                }
            });
        } else {
            groupName = trails.peek() + user.partnerGender + '_';
            trails.push(groupName);
            if (user.partnerAge === 'Any') {
                ageGroups.forEach((group) => {
                    groupName = trails.peek() + group + '_' + user.partnerCountry + '_' + user.gender + '_' + userAge;
                    groupNames.push(groupName);
                });
                trails.pop();
            } else {
                groupName = trails.pop() + user.partnerAge + '_' + user.partnerCountry + '_' + user.gender + '_' + userAge;
                groupNames.push(groupName);
            }
        }
    }

    groupNames.forEach((groupName) => {
        let group = groups.get(groupName);
        if (group !== undefined) {
            if (group.length > 0) {
                validGroups.push(groupName);
            }
        }
    });

    return validGroups.splice(Math.floor(Math.random() * validGroups.length), 1)[0];
}

/**
 * Generate age group from age.
 */
function ageToGroup(age) {
    const ageGroups = ['18-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-59', '60+'];
    switch (true) {
        case age >= 18 && age <= 24:
            return ageGroups[0];
        case age >= 25 && age <= 29:
            return ageGroups[1];
        case age >= 30 && age <= 34:
            return ageGroups[2];
        case age >= 35 && age <= 39:
            return ageGroups[3];
        case age >= 40 && age <= 44:
            return ageGroups[4];
        case age >= 45 && age <= 49:
            return ageGroups[5];
        case age >= 50 && age <= 59:
            return ageGroups[6];
        case age >= 60:
            return ageGroups[7];
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
        client.country = info.myCountry;
        client.partnerGender = info.partnerGender;
        client.partnerAge = info.partnerAge;
        client.partnerCountry = info.partnerCountry;

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

console.log('WebSocket Server is listening on port ' + port + '!')